const neo4j = require('neo4j-driver');

const driver = neo4j.driver(
    process.env.NEO4J_URI || 'bolt://localhost:7687',
    neo4j.auth.basic('neo4j', 'password'),
    { encrypted: false }
);

const run = async () => {
    const session = driver.session();
    try {
        console.log("🛠️ Fixing '1upHealth' data...");
        // 1. Assign 'Health IT' domain to 1upHealth (if missing)
        await session.run(`
            MATCH (c:Company {name: '1upHealth'})
            MERGE (d:Domain {name: 'Health IT'})
            MERGE (c)-[:OPERATES_IN]->(d)
            RETURN c, d
        `);
        console.log("   ✅ Assigned Domain 'Health IT' to '1upHealth'.");

        // 2. Search for Level 1 Conflicts
        // Find Investors who invested in OTHER companies in 'Health IT'
        console.log("\n🔍 Searching for Conflicts for Target: '1upHealth'...");
        const res = await session.run(`
            MATCH (target:Company {name: '1upHealth'})-[:OPERATES_IN]->(d:Domain)
            MATCH (other:Company)-[:OPERATES_IN]->(d)
            WHERE other.name <> target.name
            MATCH (i:Investor)-[:INVESTED_IN]->(other)
            RETURN DISTINCT i.name as investor, other.name as conflicting_company
            LIMIT 5
        `);

        if (res.records.length > 0) {
            console.log("   ⚠️ Level 1 Conflicts Found (Invested in other Health IT companies):");
            res.records.forEach(r => {
                console.log(`      - Investor: "${r.get('investor')}" (Conflict via: "${r.get('conflicting_company')}")`);
            });
        } else {
            console.log("   🔸 No Level 1 Conflicts found (No other Health IT investments).");
        }

    } catch (err) {
        console.error("Error:", err);
    } finally {
        await session.close();
        await driver.close();
    }
};

run();
