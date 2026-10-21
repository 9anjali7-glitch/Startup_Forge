require('dotenv').config();
const neo4j = require('neo4j-driver');

const uri = process.env.NEO4J_URI || 'bolt://localhost:7687';
const driver = neo4j.driver(
    uri,
    neo4j.auth.basic(process.env.NEO4J_USER || 'neo4j', process.env.NEO4J_PASSWORD || 'password'),
    uri.startsWith('bolt') ? { encrypted: false } : {}
);

async function verifyCloudCoi() {
    const session = driver.session();
    try {
        console.log("☁️  Verifying Cloud Neo4j COI Queries...");

        // 1. Basic Count
        const countRes = await session.run('MATCH (n) RETURN count(n) as total');
        console.log(`   Nodes in Graph: ${countRes.records[0].get('total')}`);

        // 2. Check 1upHealth Domain
        const domRes = await session.run("MATCH (c:Company {name: '1upHealth'})-[:OPERATES_IN]->(d:Domain) RETURN d.name");
        if (domRes.records.length > 0) {
            console.log(`   ✅ 1upHealth Domain: ${domRes.records[0].get('d.name')}`);
        } else {
            console.error("   ❌ 1upHealth has no domain!");
        }

        // 3. Test Level 1 Conflict Query (Sector Overlap)
        // We know 'Mark Suster' is an investor. Let's see if he has any potential conflicts with '1upHealth' (Healthcare)
        // Or find ANY investor with a conflict.
        console.log("\n🔍 Testing Level 1 Conflict Query...");
        const l1Query = `
            MATCH (target:Company {name: '1upHealth'})-[:OPERATES_IN]->(d:Domain)
            MATCH (i:Investor)-[:INVESTED_IN]->(other:Company)-[:OPERATES_IN]->(d)
            WHERE other.name <> target.name
            RETURN i.name, other.name, d.name LIMIT 3
        `;
        const l1Res = await session.run(l1Query);
        if (l1Res.records.length > 0) {
            console.log("   ✅ Level 1 Query works! Found conflicts:");
            l1Res.records.forEach(r => {
                console.log(`      - Investor ${r.get('i.name')} invested in ${r.get('other.name')} (${r.get('d.name')})`);
            });
        } else {
            console.log("   🔸 Level 1 Query returned no results (might be expected if data is sparse).");
        }

    } catch (e) {
        console.error("❌ Verification Failed:", e);
    } finally {
        await session.close();
        await driver.close();
    }
}

verifyCloudCoi();
