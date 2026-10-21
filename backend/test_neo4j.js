const neo4j = require('neo4j-driver');

const driver = neo4j.driver(
    'bolt://localhost:7687',
    neo4j.auth.basic('neo4j', 'password'),
    { encrypted: false }
);

async function testConnection() {
    const session = driver.session();
    try {
        console.log("Testing Neo4j Connection...");
        const result = await session.run('RETURN 1 AS num');
        console.log("✅ Connection Successful. Result:", result.records[0].get('num').toInt());

        console.log("Testing Search Query...");
        const search = await session.run(`MATCH (i:Investor) RETURN i.name LIMIT 1`);
        if (search.records.length > 0) {
            console.log("✅ Found Investor:", search.records[0].get('i.name'));
        } else {
            console.log("⚠️ No Investors found in DB. (Sync might be needed)");
        }

    } catch (e) {
        console.error("❌ Connection Failed:", e);
    } finally {
        await session.close();
        await driver.close();
    }
}

testConnection();
