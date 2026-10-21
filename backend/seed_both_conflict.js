const neo4j = require('neo4j-driver');

const driver = neo4j.driver(
    process.env.NEO4J_URI || "bolt://localhost:7687",
    neo4j.auth.basic("neo4j", "password")
);

const seedBoth = async () => {
    const session = driver.session();
    try {
        console.log("🌱 Seeding 'BOTH' Conflict Example...");

        // Create a scenario where:
        // 1. Investor invests in 'Double Trouble Corp' (Level 1 source)
        // 2. 'Double Trouble Corp' operates in 'High Stakes Domain'
        // 3. TARGET operates in 'High Stakes Domain'
        //    (Satisfies Level 1)
        //
        // 4. 'Double Trouble Corp' OWNS 'Mini Trouble Ltd'
        // 5. 'Mini Trouble Ltd' COMPETES WITH TARGET
        //    (Satisfies Level 2 via the SAME root investment, or we could add a separate one)

        // Efficient cleanup
        await session.run(`
            MATCH (n)
            WHERE n.name IN ['Risk Taker', 'Double Trouble Corp', 'Mini Trouble Ltd', 'Victim Corp', 'High Stakes Domain']
            DETACH DELETE n
        `);

        await session.run(`
            // Create Entities
            CREATE (i:Investor {name: 'Risk Taker'})
            CREATE (parent:Company {name: 'Double Trouble Corp'})
            CREATE (sub:Company {name: 'Mini Trouble Ltd'})
            CREATE (target:Company {name: 'Victim Corp'})
            CREATE (d:Domain {name: 'High Stakes Domain'})

            // Level 1: Sector Overlap
            MERGE (parent)-[:OPERATES_IN]->(d)
            MERGE (target)-[:OPERATES_IN]->(d)
            MERGE (i)-[:INVESTED_IN]->(parent)

            // Level 2: Subsidiary Competitor
            MERGE (parent)-[:HAS_SUBSIDIARY]->(sub)
            MERGE (sub)-[:COMPETES_WITH]->(target)
        `);

        console.log("✅ Seeded successfully.");
        console.log("   Investor: 'Risk Taker'");
        console.log("   Target: 'Victim Corp'");

    } catch (err) {
        console.error("❌ Seeding failed:", err);
    } finally {
        await session.close();
        await driver.close();
    }
};

seedBoth();
