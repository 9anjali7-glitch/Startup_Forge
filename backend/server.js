require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const express = require('express');
const cors = require('cors');
const { timingSafeEqual } = require('crypto');
const pool = require('./db');
const chatRoutes = require('./chat.routes');
const inboxRoutes = require('./inbox.routes');
const connectionRoutes = require('./connections.routes');
const investmentRoutes = require('./investments.routes');
const marketRoutes = require('./market.routes');
const { router: authRoutes, authenticateToken } = require('./auth.routes');


const app = express();
// Cloud hosts inject PORT at runtime; Compose maps this to 3000.
const PORT = Number.parseInt(process.env.PORT || '3000', 10);
app.set('trust proxy', 1);

/* ---------------- MIDDLEWARE ---------------- */
const allowedOrigins = (process.env.CORS_ORIGINS || (process.env.NODE_ENV === 'production' ? '' : 'http://localhost:5173,http://127.0.0.1:5173'))
  .split(',').map(origin => origin.trim()).filter(Boolean);
app.use(cors({
  origin: (origin, callback) => callback(null, !origin || allowedOrigins.includes(origin)),
  credentials: false,
}));
app.use(express.json({ limit: '1mb' }));

app.get('/', (req, res) => res.send('StartupForge Backend Running'));

// Administrative data mutation routes require a secret and POST to avoid
// accidental execution by crawlers, previews, or cross-site navigation.
const setupDatabase = require('./db_setup');
const adminKey = process.env.ADMIN_API_KEY || '';
function requireAdmin(req, res, next) {
  const supplied = req.get('x-admin-api-key') || '';
  const expected = Buffer.from(adminKey);
  const actual = Buffer.from(supplied);
  if (!adminKey) return res.status(503).json({ error: 'Administrative routes are disabled until ADMIN_API_KEY is configured.' });
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
    return res.status(401).json({ error: 'Invalid administrative credentials.' });
  }
  next();
}

async function requireAuthenticatedSessions(req, res, next) {
  const token = req.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (!token) {
    if (process.env.NODE_ENV !== 'production') return next();
    return res.status(401).json({ error: 'Sign in to use this feature.' });
  }
  try {
    const account = await authenticateToken(token);
    if (!account) return res.status(401).json({ error: 'Your session expired. Sign in again.' });
    const claimedUserId = req.get('x-user-id');
    if (claimedUserId && claimedUserId !== String(account.user_id)) {
      return res.status(403).json({ error: 'This session cannot act as another user.' });
    }
    req.auth = { id: String(account.user_id), name: account.name, role: account.role };
    req.headers['x-user-id'] = req.auth.id;
    req.headers['x-user-role'] = req.auth.role;
    if (req.body && typeof req.body === 'object') {
      if ('userId' in req.body) req.body.userId = req.auth.id;
      if ('sender_id' in req.body) req.body.sender_id = req.auth.id;
      if ('sender_role' in req.body) req.body.sender_role = req.auth.role;
      if ('role' in req.body) req.body.role = req.auth.role;
    }
    next();
  } catch (error) {
    console.error('Session verification failed:', error.message);
    res.status(503).json({ error: 'Authentication is temporarily unavailable.' });
  }
}

app.post('/setup-db', requireAdmin, (req, res) => {
  setupDatabase(res);
});

// Full CSV Seed Route
const seedFullDatabase = require('./seed_full');
app.post('/seed-full', requireAdmin, (req, res) => {
  seedFullDatabase(res);
});

app.use('/api/auth', authRoutes);

/* ---------------- HEALTH CHECK ---------------- */
/**
 * Use this to verify:
 * 1. Server is running
 * 2. Database is reachable
 */
app.get('/health', async (req, res) => {
  const dependencies = { db: 'unknown', graph: 'unknown' };
  try {
    await pool.query('SELECT 1');
    dependencies.db = 'connected';
  } catch (err) {
    dependencies.db = 'disconnected';
    console.error('Database health check failed:', err.message);
  }
  try {
    if (!driver) throw new Error('Neo4j driver is not configured');
    await driver.verifyConnectivity();
    dependencies.graph = 'connected';
  } catch (err) {
    dependencies.graph = 'disconnected';
    console.error('Neo4j health check failed:', err.message);
  }
  const healthy = dependencies.db === 'connected' && dependencies.graph === 'connected';
  res.status(healthy ? 200 : 503).json({
    status: healthy ? 'ok' : 'degraded',
    ...dependencies,
    timestamp: new Date().toISOString(),
  });
});

/* ---------------- ROUTES ---------------- */
app.use(['/chat', '/inbox', '/connections', '/api/investments', '/api/coi'], requireAuthenticatedSessions);
app.use('/chat', chatRoutes);
app.use('/inbox', inboxRoutes);
app.use('/connections', connectionRoutes);
app.use('/api/investments', investmentRoutes);
app.use('/api/market', marketRoutes);

const coiRouter = require('./coiService');
app.use('/api/coi', coiRouter);

const foundersRoutes = require('./founders.routes');
app.use('/api/founders', foundersRoutes);

// LOGIN ENDPOINT (Name -> ID Resolution)
const neo4j = require('neo4j-driver');
const { ensureCoiDemoFixtures } = require('./coiDemoFixtures');
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
  if (process.env.NODE_ENV === 'production' && process.env.ALLOW_INSECURE_DEMO_LOGIN !== 'true') {
    return res.status(503).json({ error: 'Name-only demo login is disabled in production. Configure a real authentication provider first.' });
  }
  const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
  const role = typeof req.body?.role === 'string' ? req.body.role.trim().toLowerCase() : '';
  if (!name || name.length > 120 || !['founder', 'investor'].includes(role)) {
    return res.status(400).json({ error: 'Enter a valid name (up to 120 characters) and choose Founder or Investor.' });
  }

  const session = driver.session();
  try {
    let result;
    if (role === 'investor') {
      // Provide a valid sign-in for the explicitly synthetic screening demo.
      // Seeding is repeatable and isolated to this one named demo account.
      if (/^jordan lee(?: \(demo investor\))?$/i.test(name)) {
        await ensureCoiDemoFixtures(session);
      }
      result = await session.run(
        `MATCH (u:Investor) WHERE toLower(trim(u.name)) = toLower($name)
           OR (toLower($name) = 'jordan lee' AND u.id = 'demo-investor-jordan-lee')
         RETURN u.id AS id, u.name AS name, u.firm_name AS headline, 'investor' AS role
         ORDER BY u.id LIMIT 1`,
        { name }
      );
      // If the supplied name is a fund name, choose a deterministic matching
      // investor profile instead of treating a shared fund as an ambiguous person.
      if (result.records.length === 0) {
        result = await session.run(
          `MATCH (u:Investor) WHERE toLower(trim(coalesce(u.firm_name, ''))) = toLower($name)
           RETURN u.id AS id, u.name AS name, u.firm_name AS headline, 'investor' AS role
           ORDER BY u.id LIMIT 1`,
          { name }
        );
      }
    } else {
      result = await session.run(
        `MATCH (u:Company) WHERE toLower(trim(u.name)) = toLower($name)
         RETURN u.id AS id, coalesce(u.founder, u.name) AS name, u.name AS headline, 'founder' AS role
         ORDER BY u.id LIMIT 1`,
        { name }
      );
      // The demo helper uses the company name. Resolve that exact company first;
      // only ask for a person's full name when no company matches.
      if (result.records.length === 0) {
        result = await session.run(
          `MATCH (u:Company) WHERE toLower(trim(coalesce(u.founder, ''))) = toLower($name)
           RETURN u.id AS id, u.founder AS name, u.name AS headline, 'founder' AS role
           ORDER BY u.id LIMIT 1`,
          { name }
        );
      }
    }

    if (result.records.length > 1) {
      return res.status(409).json({ error: 'That name matches multiple profiles. Enter the person’s full name or an exact company/fund name.' });
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
        AND trim(toString(c.founder)) <> ''
        AND toLower(trim(toString(c.founder))) <> toLower(trim(toString(c.name)))
      WITH c.name AS company, collect(c) AS copies
      WITH company, copies[0] AS c
      RETURN c.id as id, c.founder as name, c.name as company, c.valuation as valuation, 
             c.round as round, c.year as year, c.domain as domain
      ORDER BY c.valuation DESC
      LIMIT 10
    `;

    const result = await session.run(query);

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
    res.status(503).json({ success: false, error: 'Founder profiles are temporarily unavailable. Please retry in a moment.' });
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

