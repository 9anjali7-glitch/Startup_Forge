require('dotenv').config();
const { Pool } = require('pg');
const neo4j = require('neo4j-driver');

// Postgres setup
const pool = new Pool({
    host: 'localhost',
    port: 5432,
    user: 'postgres',
    password: 'password', // Assuming this works based on typical local setup or lack of auth in previous files
    database: 'startupforge_db'
});

// Neo4j setup
const uri = process.env.NEO4J_URI || 'bolt://localhost:7687';
const driver = neo4j.driver(
    uri,
    neo4j.auth.basic(process.env.NEO4J_USER || 'neo4j', process.env.NEO4J_PASSWORD || 'password'),
    // For Aura (neo4j+s), encryption is implied by the scheme. passing it in config causes error.
    // Only disable it explicitly for local bolt if needed, but usually defaults work.
    // Safest is to pass empty config for Aura.
    uri.startsWith('bolt') ? { encrypted: false } : {}
);

const syncData = async () => {
    const session = driver.session();
    try {
        console.log("🌱 Cleaning up old graph data...");
        await session.run('MATCH (n) DETACH DELETE n');

        // ------------------------------------------------------------
        // 1. PROCESS INVESTORS (From Postgres)
        // ------------------------------------------------------------
        console.log("💸 Fetching Investors from Postgres...");
        const invRes = await pool.query('SELECT * FROM investors');

        for (const row of invRes.rows) {
            // Postgres row: id, name, primary_domain, past_investments (json)
            const id = String(row.id);
            const name = row.name;
            const domain = row.primary_domain;
            const investments = row.past_investments; // already JSON object

            await session.run(`
                MERGE (i:Investor {id: $id})
                SET i.name = $name
                SET i.domain = $domain
            `, { id, name, domain });

            if (Array.isArray(investments)) {
                for (const inv of investments) {
                    const companyName = inv.company_name;
                    if (companyName) {
                        // Link Investor -> Company
                        // Propagate Domain heuristic
                        await session.run(`
                            MATCH (i:Investor {id: $id})
                            MERGE (c:Company {name: $companyName})
                            MERGE (i)-[:INVESTED_IN]->(c)
                            WITH i, c
                            WHERE i.domain IS NOT NULL AND i.domain <> ""
                            MERGE (d:Domain {name: i.domain})
                            MERGE (c)-[:OPERATES_IN]->(d)
                        `, { id, companyName });
                    }
                }
            }
        }
        console.log(`   ✅ Processed ${invRes.rows.length} investors.`);

        // ------------------------------------------------------------
        // 2. PROCESS FOUNDERS (From Postgres)
        // ------------------------------------------------------------
        console.log("🏢 Fetching Founders from Postgres...");
        const fdrRes = await pool.query('SELECT * FROM founders');

        for (const row of fdrRes.rows) {
            // Postgres row: id, name (founder), company, domain (url), past_funding, valuation, competitors, umbrella_companies
            const id = String(row.id);
            const companyName = row.company;
            if (!companyName) continue;

            const domainName = row.domain; // URL
            const founderName = row.name;
            const valuation = row.valuation ? Number(row.valuation) : 0;
            const competitors = row.competitors; // Array
            const parents = row.umbrella_companies; // Array

            // Extract round/year from past_funding JSON
            let round = 'Seed';
            let year = 2022;
            if (row.past_funding) {
                round = row.past_funding.round || round;
                year = row.past_funding.year || year;
            }

            await session.run(`
                MERGE (c:Company {name: $companyName})
                SET c.id = $id
                SET c.founder = $founderName, 
                    c.valuation = $valuation,
                    c.round = $round,
                    c.year = $year
                // Note: Ignoring domainName (URL) for OPERATES_IN to avoid bad sectors
            `, {
                id, companyName, founderName, valuation, round, year
            });

            // Link Subsidiaries
            if (Array.isArray(parents)) {
                for (const parentName of parents) {
                    await session.run(`
                        MATCH (c:Company {name: $companyName})
                        MERGE (p:Company {name: $parentName})
                        MERGE (p)-[:HAS_SUBSIDIARY]->(c)
                    `, { companyName, parentName });
                }
            }

            // Link Competitors
            if (Array.isArray(competitors)) {
                for (const compName of competitors) {
                    await session.run(`
                        MATCH (c:Company {name: $companyName})
                        MERGE (comp:Company {name: $compName})
                        MERGE (c)-[:COMPETES_WITH]->(comp)
                    `, { companyName, compName });
                }
            }
        }
        console.log(`   ✅ Processed ${fdrRes.rows.length} founders.`);
        console.log("✅ DB->Neo4j Sync complete!");

    } catch (e) {
        console.error("❌ Sync failed:", e);
    } finally {
        await session.close();
        await driver.close();
        await pool.end();
    }
};

syncData();
