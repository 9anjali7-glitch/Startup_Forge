const neo4j = require('neo4j-driver');

const driver = neo4j.driver(
    process.env.NEO4J_URI || 'bolt://localhost:7687',
    neo4j.auth.basic('neo4j', 'password'),
    { encrypted: false }
);

const run = async () => {
    const session = driver.session();
    try {
        console.log("🔍 Checking Top Domains by Investor Activity...");
        const res = await session.run(`
            MATCH (d:Domain)<-[:OPERATES_IN]-(c:Company)<-[:INVESTED_IN]-(i:Investor)
            RETURN d.name as domain, count(DISTINCT c) as companies, count(DISTINCT i) as investors
            ORDER BY investors DESC
            LIMIT 10
        `);

        res.records.forEach(r => {
            console.log(`   - Domain: "${r.get('domain')}" | Companies: ${r.get('companies')} | Investors: ${r.get('investors')}`);
        });

        // Check Health IT specifically
        const healthRes = await session.run(`
            MATCH (d:Domain {name: 'Health IT'})<-[:OPERATES_IN]-(c:Company)
            RETURN c.name as company
        `);
        console.log("\n   🏥 Health IT Companies in DB:");
        if (healthRes.records.length === 0) console.log("      (None)");
        healthRes.records.forEach(r => console.log(`      - ${r.get('company')}`));

    } catch (err) {
        console.error("Error:", err);
    } finally {
        await session.close();
        await driver.close();
    }
};

run();
