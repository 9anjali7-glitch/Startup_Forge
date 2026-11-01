const pool = require('./db');
const neo4j = require('neo4j-driver');

async function setupDatabase(res) {
    try {
        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            // 1. Investors Table
            await client.query(`
        CREATE TABLE IF NOT EXISTS investors (
          id SERIAL PRIMARY KEY,
          name VARCHAR(255) NOT NULL,
          firm_name VARCHAR(255),
          short_bio TEXT,
          location VARCHAR(100),
          profile_url TEXT,
          primary_domain VARCHAR(100)
        );
      `);

            // Keep the restored investor archive usable on fresh installs too.
            const investorColumns = [
                ['investor_type', 'TEXT'], ['secondary_domains', 'TEXT[]'],
                ['investment_stage_pref', 'TEXT[]'], ['website', 'TEXT'],
                ['linkedin_url', 'TEXT'], ['twitter_url', 'TEXT'],
                ['past_investments', "JSONB DEFAULT '[]'::jsonb"],
                ['total_investments_count', 'INTEGER'], ['notable_investments', 'TEXT[]'],
                ['is_active_investing', 'BOOLEAN'], ['investment_thesis', 'TEXT'],
                ['tags', 'TEXT[]'], ['source', 'TEXT'], ['confidence_score', 'NUMERIC'],
                ['created_at', 'TIMESTAMPTZ'], ['updated_at', 'TIMESTAMPTZ']
            ];
            for (const [column, type] of investorColumns) {
                await client.query(`ALTER TABLE investors ADD COLUMN IF NOT EXISTS ${column} ${type}`);
            }

            // 2. Founders Table
            await client.query(`
        CREATE TABLE IF NOT EXISTS founders (
          id SERIAL PRIMARY KEY,
          name VARCHAR(255) NOT NULL,
          company VARCHAR(255),
          description TEXT,
          location VARCHAR(100),
          domain VARCHAR(100),
          valuation NUMERIC,
          round VARCHAR(50),
          year INTEGER,
          past_funding JSONB DEFAULT '[]'
        );
      `);

            // 3. Connections Table
            await client.query(`
        CREATE TABLE IF NOT EXISTS connections (
          id SERIAL PRIMARY KEY,
          user_a_id INTEGER NOT NULL,
          user_b_id INTEGER NOT NULL,
          status VARCHAR(50) DEFAULT 'connected',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `);

            // 4. Investment Reports Table
            await client.query(`
        CREATE TABLE IF NOT EXISTS investment_reports (
            id SERIAL PRIMARY KEY,
            connection_id INTEGER, -- nullable if not strictly enforcing backend FK for demo
            submitted_by VARCHAR(50) NOT NULL,
            role VARCHAR(20) NOT NULL,
            round VARCHAR(50),
            year INTEGER,
            amount NUMERIC,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `);

            // --- SEED DATA ---
            // check if Mark Suster exists
            const markCheck = await client.query("SELECT id FROM investors WHERE name = 'Mark Suster'");
            if (markCheck.rows.length === 0) {
                await client.query(`
          INSERT INTO investors (name, firm_name, short_bio, location, profile_url, primary_domain)
          VALUES ('Mark Suster', 'Upfront Ventures', 'Partner at Upfront Ventures.', 'Los Angeles', NULL, 'SaaS')
        `);
            }

            // check if 1upHealth exists
            const healthCheck = await client.query("SELECT id FROM founders WHERE company = '1upHealth'");
            if (healthCheck.rows.length === 0) {
                await client.query(`
          INSERT INTO founders (name, company, description, location, domain, valuation, round, year, past_funding)
          VALUES ('Ricky Sahu', '1upHealth', 'Connecting healthcare data.', 'Boston', 'Healthcare', 50000000, 'Series A', 2024, '[{"round": "Seed", "year": 2023}]')
        `);
            }

            const investors = (await client.query('SELECT * FROM investors ORDER BY id')).rows;
            const founders = (await client.query('SELECT * FROM founders ORDER BY id')).rows;
            const neo4jUri = process.env.NEO4J_URI || 'bolt://host.docker.internal:7687';
            const graphDriver = neo4j.driver(
                neo4jUri,
                neo4j.auth.basic(
                    process.env.NEO4J_USER || 'neo4j',
                    process.env.NEO4J_PASSWORD || 'password'
                ),
                neo4jUri.startsWith('bolt') ? { encrypted: false } : {}
            );
            try {
                const graphSession = graphDriver.session();
                try {
                    for (const row of investors) {
                        await graphSession.run(`
                            MERGE (i:Investor {name: $name})
                            SET i.id = toString($id), i.firm_name = $firm_name,
                                i.short_bio = $short_bio, i.location = $location,
                                i.profile_url = $profile_url, i.domain = $primary_domain,
                                i.primary_domain = $primary_domain, i.investor_type = $investor_type,
                                i.investment_stage_pref = $investment_stage_pref,
                                i.secondary_domains = $secondary_domains,
                                i.past_investments = $past_investments, i.investment_thesis = $investment_thesis,
                                i.notable_investments = $notable_investments, i.tags = $tags,
                                i.total_investments_count = $total_investments_count,
                                i.is_active_investing = $is_active_investing
                            RETURN i
                        `, {
                            id: row.id, name: row.name, firm_name: row.firm_name,
                            short_bio: row.short_bio, location: row.location,
                            profile_url: row.profile_url, primary_domain: row.primary_domain,
                            investor_type: row.investor_type,
                            investment_stage_pref: row.investment_stage_pref || [],
                            secondary_domains: row.secondary_domains || [],
                            past_investments: JSON.stringify(row.past_investments || []),
                            investment_thesis: row.investment_thesis,
                            notable_investments: row.notable_investments || [], tags: row.tags || [],
                            total_investments_count: row.total_investments_count,
                            is_active_investing: row.is_active_investing
                        });
                    }
                    for (const row of founders) {
                        await graphSession.run(`
                            MERGE (c:Company {name: $company})
                            SET c.id = toString($id), c.founder = $name,
                                c.domain = $domain, c.location = $location,
                                c.valuation = $valuation, c.round = $round,
                                c.year = $year, c.description = $description
                        `, { id: String(row.id), company: row.company || row.name,
                            name: row.name, domain: row.domain, location: row.location,
                            valuation: row.valuation == null ? null : Number(row.valuation),
                            round: row.round, year: row.year, description: row.description });
                    }

                    // Remove only the previous synthetic demo fixtures. Never clear the user's graph.
                    await graphSession.run(`
                        MATCH (c:Company)
                        WHERE c.id IN ['demo-direct-portfolio', 'demo-direct-target', 'demo-indirect-parent', 'demo-indirect-subsidiary', 'demo-indirect-target']
                        DETACH DELETE c
                    `);

                    // Synthetic scenarios use a fictional investor; no demo conflict is attributed to a real person.
                    await graphSession.run(`
                        MERGE (demoInvestor:Investor {id: 'demo-investor-jordan-lee'})
                        SET demoInvestor.name = 'Jordan Lee (Demo Investor)',
                            demoInvestor.firm_name = 'Northstar Capital (Demo)',
                            demoInvestor.domain = 'Healthcare Technology',
                            demoInvestor.demo_fixture = true

                        MERGE (healthFounder:Company {name: '1upHealth'})
                        MERGE (mark:Investor {name: 'Mark Suster'})
                        MERGE (mark)-[:CONNECTED_TO]->(healthFounder)
                        MERGE (healthFounder)-[:CONNECTED_TO]->(mark)

                        MERGE (domain:Domain {name: 'Healthcare Technology'})
                        MERGE (directPortfolio:Company {id: 'demo-direct-portfolio'})
                        SET directPortfolio.name = 'Harbor Health Analytics',
                            directPortfolio.domain = 'Healthcare Technology',
                            directPortfolio.description = 'Synthetic healthcare data platform used as a direct competitor fixture.',
                            directPortfolio.demo_fixture = true
                        MERGE (directTarget:Company {id: 'demo-direct-target'})
                        SET directTarget.name = 'Northstar Care Systems',
                            directTarget.domain = 'Healthcare Technology',
                            directTarget.description = 'Synthetic target company for the direct portfolio conflict demo.',
                            directTarget.demo_fixture = true
                        MERGE (demoInvestor)-[:INVESTED_IN {evidence_type: 'synthetic demo fixture', notes: 'Seeded only to demonstrate an explicit portfolio relationship.'}]->(directPortfolio)
                        MERGE (directPortfolio)-[:OPERATES_IN]->(domain)
                        MERGE (directTarget)-[:OPERATES_IN]->(domain)
                        MERGE (directPortfolio)-[directCompetition:COMPETES_WITH]->(directTarget)
                        SET directCompetition.evidence_type = 'synthetic demo fixture',
                            directCompetition.notes = 'Illustrative direct competitor relationship; not a real-world diligence finding.'

                        MERGE (parent:Company {id: 'demo-indirect-parent'})
                        SET parent.name = 'Summit Digital Holdings',
                            parent.description = 'Synthetic holding company used for the indirect conflict demo.',
                            parent.demo_fixture = true
                        MERGE (subsidiary:Company {id: 'demo-indirect-subsidiary'})
                        SET subsidiary.name = 'Summit Care Networks',
                            subsidiary.domain = 'Healthcare Technology',
                            subsidiary.description = 'Synthetic subsidiary used for the indirect conflict demo.',
                            subsidiary.demo_fixture = true
                        MERGE (indirectTarget:Company {id: 'demo-indirect-target'})
                        SET indirectTarget.name = 'Cedarline Health',
                            indirectTarget.domain = 'Healthcare Technology',
                            indirectTarget.description = 'Synthetic target company for the indirect ownership demo.',
                            indirectTarget.demo_fixture = true
                        MERGE (demoInvestor)-[:INVESTED_IN {evidence_type: 'synthetic demo fixture', notes: 'Seeded only to demonstrate parent-company exposure.'}]->(parent)
                        MERGE (parent)-[ownership:HAS_SUBSIDIARY]->(subsidiary)
                        SET ownership.evidence_type = 'synthetic demo fixture'
                        MERGE (subsidiary)-[indirectCompetition:COMPETES_WITH]->(indirectTarget)
                        SET indirectCompetition.evidence_type = 'synthetic demo fixture',
                            indirectCompetition.notes = 'Illustrative indirect competitor relationship; not a real-world diligence finding.'
                    `);
                } finally {
                    await graphSession.close();
                }
            } finally {
                await graphDriver.close();
            }
            await client.query('COMMIT');
            res.send(`
        <h1>Database Setup Complete ✅</h1>
        <p>Schema is ready. Synchronized ${investors.length} investors and ${founders.length} founders into Neo4j.</p>
        <p>You can now return to the frontend and log in with a restored profile.</p>
      `);

        } catch (e) {
            await client.query('ROLLBACK');
            throw e;
        } finally {
            client.release();
        }
    } catch (err) {
        console.error("Setup DB Failed:", err);
        res.status(500).send("Database Setup Failed: " + err.message);
    }
}

module.exports = setupDatabase;
