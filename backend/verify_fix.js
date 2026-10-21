const neo4j = require('neo4j-driver');

const driver = neo4j.driver(
    process.env.NEO4J_URI || "bolt://localhost:7687",
    neo4j.auth.basic("neo4j", "password")
);

const verifyCOI = async () => {
    try {
        console.log("🔍 Verifying COI Fix...");

        // 1. Ensure required data exists in Neo4j
        const session = driver.session();
        try {
            await session.run(`
                MERGE (i:Investor {name: 'Eyal Gura'})
                MERGE (parent:Company {name: 'Parent Holding Corp'})
                MERGE (sub:Company {name: 'Subsidiary Corp'})
                MERGE (target:Company {name: 'Kapital'})
                
                MERGE (i)-[:INVESTED_IN]->(parent)
                MERGE (parent)-[:HAS_SUBSIDIARY]->(sub)
                MERGE (sub)-[:COMPETES_WITH]->(target)
            `);
            console.log("✅ Seeded/Ensured test data for Eyal Gura vs Kapital");
        } finally {
            await session.close();
        }

        // 2. Call the API
        console.log("📡 Calling API...");
        try {
            const response = await fetch('http://localhost:3000/api/coi/check', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    investorName: 'Eyal Gura',
                    targetCompany: 'Kapital'
                })
            });

            const data = await response.json();
            console.log("📥 API Response:", JSON.stringify(data, null, 2));

            if (data.hasConflict && data.conflictLevel === 2) {
                console.log("✅ SUCCESS: Level 2 Conflict detected correctly!");
            } else {
                console.error("❌ FAILURE: Expected Level 2 Conflict, but got:", data);
            }

        } catch (apiError) {
            console.error("❌ API Request Failed:", apiError.message);
        }

    } catch (err) {
        console.error("❌ Verification Script Error:", err);
    } finally {
        await driver.close();
    }
};

verifyCOI();
