const neo4j = require('neo4j-driver');

const driver = neo4j.driver(
    'bolt://localhost:7687',
    neo4j.auth.basic('neo4j', 'password'),
    { encrypted: false }
);

async function seedDemoData() {
    const session = driver.session();
    try {
        console.log("🌱 Seeding Demo Conflict Data for 'Eyal Gura' vs 'Kapital'...");

        // 1. Ensure Nodes Exist (Merge to avoid dupes)
        // Investor: Eyal Gura
        // Target: Kapital
        // Parent: UnitedHealth Group
        // Subsidiary: Theator

        // 2. Create the Conflict Path:
        // Eyal Gura -[:INVESTED_IN]-> UnitedHealth Group
        // UnitedHealth Group -[:HAS_SUBSIDIARY]-> Theator
        // Theator -[:COMPETES_WITH]-> Kapital

        // Single query to ensure all nodes and relationships exist
        await session.run(`
            MERGE (i:Investor {name: 'Eyal Gura'})
            MERGE (t:Company {name: 'Kapital'})
            MERGE (p1:Company {name: 'UnitedHealth Group'})
            MERGE (p2:Company {name: 'BigAdTech'})
            MERGE (s:Company {name: 'Theator'})
            
            // Link Investor to Parents
            MERGE (i)-[:INVESTED_IN]->(p1)
            MERGE (i)-[:INVESTED_IN]->(p2)

            // Link Parents to Subsidiary
            MERGE (p1)-[:HAS_SUBSIDIARY]->(s)
            MERGE (p2)-[:HAS_SUBSIDIARY]->(s)

            // Link Subsidiary to Competes With Target
            MERGE (s)-[:COMPETES_WITH]->(t)
        `);

        console.log("✅ Demo Data Injected Successfully.");

    } catch (e) { console.error(e); }
    finally { await session.close(); driver.close(); }
}

seedDemoData();
