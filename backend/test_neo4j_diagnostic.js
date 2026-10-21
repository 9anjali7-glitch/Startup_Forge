const neo4j = require('neo4j-driver');

const configs = [
    { name: "Config A", url: 'bolt://localhost:7687', opts: { encrypted: false } }, // Explicit Disable
    { name: "Config B", url: 'neo4j://localhost:7687', opts: { encrypted: false } }, // Scheme neo4j://
    { name: "Config C", url: 'bolt://localhost:7687', opts: {} }, // Default
    { name: "Config D", url: 'bolt://127.0.0.1:7687', opts: { encrypted: false } } // IPv4 Force
];

async function runTests() {
    console.log("🔍 Starting Neo4j Diagnostic...");

    for (const conf of configs) {
        console.log(`\nTesting ${conf.name}: ${conf.url} ${JSON.stringify(conf.opts)}`);
        const driver = neo4j.driver(conf.url, neo4j.auth.basic('neo4j', 'password'), conf.opts);
        const session = driver.session();
        try {
            const res = await session.run('RETURN 1 AS num');
            console.log(`✅ SUCCESS! ${conf.name} worked. Result: ${res.records[0].get('num')}`);
            await session.close();
            await driver.close();
            return; // Exit on first success
        } catch (e) {
            console.log(`❌ FAILED ${conf.name}: ${e.code} - ${e.message}`);
        } finally {
            try { await session.close(); } catch (e) { }
            try { await driver.close(); } catch (e) { }
        }
    }
    console.log("\n❌ ALL CONFIGURATIONS FAILED. Please ensure Neo4j is running.");
}

runTests();
