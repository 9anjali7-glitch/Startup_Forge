const neo4j = require('neo4j-driver');

const driver = neo4j.driver(
    process.env.NEO4J_URI || "bolt://localhost:7687",
    neo4j.auth.basic("neo4j", "password")
);

const checkData = async () => {
    const session = driver.session();
    try {
        console.log("🔍 Checking 'Apple' and Search Data...");

        // 1. Check for "Apple"
        const appleQuery = `
            MATCH (n)
            WHERE toLower(n.name) CONTAINS 'apple'
            RETURN labels(n) as labels, n.name as name, n.id as id
            LIMIT 5
        `;
        const appleRes = await session.run(appleQuery);
        console.log(`\n🍎 Search for 'apple':`);
        if (appleRes.records.length > 0) {
            appleRes.records.forEach(r => {
                console.log(`   - Found: [${r.get('labels').join(', ')}] Name: "${r.get('name')}" ID: ${r.get('id')}`);
            });
        } else {
            console.log("   ❌ No node found with name containing 'apple'.");
        }

        // 2. Check total node counts
        const countQuery = `
            CALL db.labels() YIELD label
            CALL {
                WITH label
                MATCH (n) WHERE labels(n) = [label] OR label IN labels(n)
                RETURN count(n) AS count
            }
            RETURN label, count
        `;
        const countRes = await session.run(countQuery);
        console.log(`\n📊 Database Stats:`);
        countRes.records.forEach(r => {
            console.log(`   - ${r.get('label')}: ${r.get('count')}`);
        });

    } catch (err) {
        console.error("Error checking data:", err);
    } finally {
        await session.close();
        await driver.close();
    }
};

checkData();
