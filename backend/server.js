require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const express = require('express');
const cors = require('cors');
const pool = require('./db');
const chatRoutes = require('./chat.routes');
const inboxRoutes = require('./inbox.routes');
const connectionRoutes = require('./connections.routes');
const investmentRoutes = require('./investments.routes');


const app = express();
const PORT = 3000;

/* ---------------- MIDDLEWARE ---------------- */
app.use(cors());
app.use(express.json());

app.get('/', (req, res) => res.send('StartupForge Backend Running'));

// DB Setup Route
const setupDatabase = require('./db_setup');
app.get('/setup-db', (req, res) => {
  setupDatabase(res);
});

// Full CSV Seed Route
const seedFullDatabase = require('./seed_full');
app.get('/seed-full', (req, res) => {
  seedFullDatabase(res);
});

/* ---------------- HEALTH CHECK ---------------- */
/**
 * Use this to verify:
 * 1. Server is running
 * 2. Database is reachable
 */
app.get('/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.status(200).json({
      status: 'ok',
      db: 'connected',
      timestamp: new Date().toISOString()
    });

    // DEBUG: Check for investment_reports table
    const tableCheck = await pool.query("SELECT to_regclass('public.investment_reports')");
    console.log("DEBUG: investment_reports table check:", tableCheck.rows[0]);

  } catch (err) {
    console.error('DB health check failed:', err.message);
    res.status(500).json({
      status: 'error',
      db: 'disconnected'
    });
  }
});

/* ---------------- ROUTES ---------------- */
app.use('/chat', chatRoutes);
app.use('/inbox', inboxRoutes);
app.use('/connections', connectionRoutes);
app.use('/api/investments', investmentRoutes);

const coiRouter = require('./coiService');
app.use('/api/coi', coiRouter);

const foundersRoutes = require('./founders.routes');
app.use('/api/founders', foundersRoutes);

// LOGIN ENDPOINT (Name -> ID Resolution)
const neo4j = require('neo4j-driver');
let driver;
try {
  const uri = process.env.NEO4J_URI || "bolt://host.docker.internal:7687";

  driver = neo4j.driver(
    uri,
    neo4j.auth.basic(process.env.NEO4J_USER || 'neo4j', process.env.NEO4J_PASSWORD || 'password'),
    uri.startsWith('bolt') ? { encrypted: false } : {}
  );
  console.log("✅ Neo4j Driver initialized");
} catch (e) {
  console.error("❌ Neo4j Driver Fail:", e.message);
}




// LOGIN ENDPOINT (Neo4j Source)
app.post('/api/login', async (req, res) => {
  const { name, role } = req.body;
  if (!name || !role) return res.status(400).json({ error: 'Name and Role required' });

  const session = driver.session();
  try {
    let result;
    if (role.toLowerCase() === 'investor') {
      result = await session.run(
        `MATCH (u:Investor) WHERE toLower(u.name) CONTAINS toLower($name) 
         RETURN u.id AS id, u.name AS name, u.firm_name AS headline, 'investor' AS role LIMIT 1`,
        { name }
      );
    } else {
      result = await session.run(
        `MATCH (u:Company) WHERE toLower(u.founder) CONTAINS toLower($name) OR toLower(u.name) CONTAINS toLower($name)
         RETURN u.id AS id, u.founder AS name, u.name AS headline, 'founder' AS role LIMIT 1`,
        { name }
      );
    }

    if (result.records.length > 0) {
      const r = result.records[0];
      res.json({
        success: true,
        userId: r.get('id'),
        name: r.get('name'),
        role: r.get('role'),
        headline: r.get('headline')
      });
    } else {
      res.status(404).json({ error: 'User not found' });
    }
  } catch (e) {
    console.error("Login Error (Neo4j):", e);
    res.status(500).json({ error: "Server error" });
  } finally {
    session.close();
  }
});

// GET DYNAMIC FOUNDERS BY DOMAIN
// GET DYNAMIC FOUNDERS BY DOMAIN (Neo4j Source)
app.post('/api/founders/rising', async (req, res) => {
  const { userId, role } = req.body;

  const session = driver.session();
  try {
    const query = `
      MATCH (c:Company)
      WHERE c.valuation IS NOT NULL AND c.founder IS NOT NULL
      WITH c.name AS company, collect(c) AS copies
      WITH company, copies[0] AS c
      RETURN c.id as id, c.founder as name, c.name as company, c.valuation as valuation, 
             c.round as round, c.year as year, c.domain as domain
      ORDER BY c.valuation DESC
      LIMIT 10
    `;

    const result = await session.run(query);

    if (result.records.length === 0) {
      // Fallback mock if graph empty
      throw new Error("No founders in graph");
    }

    const founders = result.records.map(r => ({
      id: r.get('id'),
      name: r.get('name'),
      company: r.get('company'),
      round: r.get('round') || 'Seed',
      year: r.get('year') ? String(r.get('year')) : '2024',
      valuation: parseFloat(r.get('valuation') || 0),
      umbrella: r.get('domain') || 'Tech'
    }));

    res.json({ success: true, founders });

  } catch (err) {
    console.error("Error fetching founders from Neo4j:", err.message);
    // Fallback Mock Data
    const mockFounders = [
      { id: 'm1', company: "Nebula AI", name: "Alex Rivera", round: "Series A", year: "2024", valuation: 45000000, umbrella: "AI & ML" },
      { id: 'm2', company: "Zephyr Energy", name: "Sarah Chen", round: "Seed", year: "2023", valuation: 12000000, umbrella: "CleanTech" },
      { id: 'm3', company: "Flux Systems", name: "James Wilson", round: "Series B", year: "2022", valuation: 150000000, umbrella: "Robotics" }
    ];
    res.json({ success: true, founders: mockFounders });
  } finally {
    session.close();
  }
});


// --- NETWORK PAGE ENDPOINTS ---

/**
 * Get All Founders
 * Includes connection status relative to the requester
 */
app.get('/api/users/founders', async (req, res) => {
  const session = driver.session();
  try {
    const result = await session.run(`
      MATCH (f:Company)
      WITH f.name AS company, collect(f) AS copies
      WITH company, copies[0] AS f
      RETURN coalesce(toString(f.id), 'neo4j:' + elementId(f)) as id, coalesce(f.founder, f.name, 'Founder') as name, f.name as headline, 'https://cdn-icons-png.flaticon.com/512/149/149071.png' as avatar
      LIMIT 50
    `);
    const mapped = result.records.map(r => ({
      id: r.get('id'),
      name: r.get('name'),
      headline: r.get('headline'),
      role: 'founder',
      avatar: r.get('avatar'),
      connections: 0,
      isConnected: false
    }));
    res.json(mapped);
  } catch (e) {
    console.error("Founders Fetch Error:", e);
    res.status(500).json({ error: "Failed to fetch founders" });
  } finally {
    session.close();
  }
});

/**
 * Get All Investors
 * Includes connection status relative to the requester
 */
app.get('/api/users/investors', async (req, res) => {
  const session = driver.session();
  try {
    const result = await session.run(`
      MATCH (i:Investor)
      WITH i.name AS investor, collect(i) AS copies
      WITH investor, copies[0] AS i
      RETURN i.id as id, i.name as name, i.firm_name as headline, 'https://cdn-icons-png.flaticon.com/512/147/147144.png' as avatar
      LIMIT 50
    `);
    const mapped = result.records.map(r => ({
      id: r.get('id'),
      name: r.get('name'),
      headline: r.get('headline'),
      role: 'investor',
      avatar: r.get('avatar'),
      connections: 0,
      isConnected: false
    }));
    res.json(mapped);
  } catch (e) {
    console.error("Investors Fetch Error:", e);
    res.status(500).json({ error: "Failed to fetch investors" });
  } finally {
    session.close();
  }
});


// BATCH GET USERS (for History/Widgets)
app.post('/api/users/batch', async (req, res) => {
  const { items } = req.body; // Expects [{id: '1', role: 'founder'}]
  if (!items || !Array.isArray(items)) return res.json([]);

  try {
    const founderIds = items.filter(i => i.role === 'founder').map(i => parseInt(i.id)).filter(id => !isNaN(id));
    const investorIds = items.filter(i => i.role === 'investor').map(i => parseInt(i.id)).filter(id => !isNaN(id));

    const promises = [];

    if (founderIds.length > 0) {
      promises.push(pool.query(`
                SELECT id, name, company as headline, 'founder' as role 
                FROM founders 
                WHERE id = ANY($1::int[])
            `, [founderIds]));
    }

    if (investorIds.length > 0) {
      promises.push(pool.query(`
                SELECT id, name, firm_name as headline, 'investor' as role 
                FROM investors 
                WHERE id = ANY($1::int[])
            `, [investorIds]));
    }

    const results = await Promise.all(promises);
    const combined = results.flatMap(r => r.rows).map(u => ({
      ...u,
      id: String(u.id),
      avatar: u.role === 'founder'
        ? 'https://cdn-icons-png.flaticon.com/512/149/149071.png'
        : 'https://cdn-icons-png.flaticon.com/512/147/147144.png'
    }));

    res.json(combined);

  } catch (e) {
    console.error("Batch Fetch Error:", e);
    res.status(500).json({ error: "Server error" });
  }
});

// GET USER BY ID
// GET USER BY ID (Using Postgres primarily)
// GET USER BY ID (Neo4j Source)
app.get('/api/users/:id', async (req, res) => {
  const { id } = req.params;
  const session = driver.session();
  try {
    // Check Investor
    const invResult = await session.run(`
      MATCH (u:Investor {id: $id})
      RETURN u.name AS name, u.firm_name AS firm, 'Investor' AS role, 
             u.short_bio AS about, u.location AS location, u.profile_url AS avatar,
             u.domain AS domain
    `, { id });

    if (invResult.records.length > 0) {
      const r = invResult.records[0];
      return res.json({
        success: true,
        user: {
          id: id,
          name: r.get('name'),
          role: 'investor',
          company: r.get('firm') || 'Independent',
          title: 'Investor',
          headline: `Investor at ${r.get('firm') || 'Venture Capital'}`,
          location: r.get('location') || 'Global',
          about: r.get('about') || 'No bio available',
          avatar: r.get('avatar') || 'https://cdn-icons-png.flaticon.com/512/147/147144.png',
          tags: r.get('domain') ? [r.get('domain')] : []
        }
      });
    }

    // Check Founder
    const founderResult = await session.run(`
      MATCH (c:Company)
      WHERE toString(c.id) = $id OR ('neo4j:' + elementId(c)) = $id
      OPTIONAL MATCH (c)-[:COMPETES_WITH]->(comp:Company)
      OPTIONAL MATCH (p:Company)-[:HAS_SUBSIDIARY]->(c)
      RETURN c.founder AS name, c.name AS company, 'Founder' AS role,
             c.description AS about, c.location AS location,
             c.domain AS domain,
             c.valuation AS valuation,
             c.round AS round,
             c.year AS year,
             collect(distinct comp.name) AS competitors,
             collect(distinct p.name) AS umbrella
    `, { id });

    if (founderResult.records.length > 0) {
      const r = founderResult.records[0];
      return res.json({
        success: true,
        user: {
          id: id,
          name: r.get('name') || 'Founder',
          role: 'founder',
          company: r.get('company'),
          title: 'Founder',
          headline: `Founder of ${r.get('company')}`,
          location: r.get('location') || 'Global',
          about: r.get('about') || `Building ${r.get('company')}`,
          avatar: 'https://cdn-icons-png.flaticon.com/512/149/149071.png',
          tags: r.get('domain') ? [r.get('domain')] : [],
          valuation: r.get('valuation'),
          fundingRound: r.get('round'),
          fundingYear: r.get('year'),
          competitors: r.get('competitors'),
          umbrella: r.get('umbrella')
        }
      });
    }

    res.status(404).json({ error: 'User not found' });
  } catch (e) {
    console.error("User Fetch Error (Neo4j):", e);
    res.status(500).json({ error: "Server Error" });
  } finally {
    session.close();
  }
});




/* ---------------- SERVER START ---------------- */
const server = app.listen(PORT, () => {
  console.log(`✅ Backend API running on http://localhost:${PORT}`);
});

// Initialize Gun (Websocket Relay)
const Gun = require('gun');
Gun({ web: server });
console.log('✅ Gun.js Relay Node running on /gun');

process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

