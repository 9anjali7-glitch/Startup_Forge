const neo4j = require('neo4j-driver');

const driver = neo4j.driver(
    'bolt://localhost:7687',
    neo4j.auth.basic('neo4j', 'password'),
    { encrypted: false }
);

async function findConfirm() {
    const session = driver.session();
    try {
        console.log("🔍 Searching for Level 2 Conflict (Parent/Sub/Competitor)...");
        const resL2 = await session.run(`
            MATCH (i:Investor)-[:INVESTED_IN]->(p:Company)-[:HAS_SUBSIDIARY]->(s:Company)-[:COMPETES_WITH]->(t:Company)
            RETURN i.name, t.name, p.name, s.name LIMIT 1
        `);

        if (resL2.records.length > 0) {
            const r = resL2.records[0];
            console.log("\n✅ LEVEL 2 MATCH FOUND:");
            console.log("Investor:", r.get('i.name'));
            console.log("Target:", r.get('t.name'));
            console.log("  (Inv -> " + r.get('p.name') + " -> " + r.get('s.name') + " -> Competes " + r.get('t.name') + ")");
        } else {
            console.log("❌ No Level 2 conflicts found in current data.");
        }

        console.log("\n🔍 Searching for Level 1 Conflict (Sector Overlap)...");
        const resL1 = await session.run(`
            MATCH (i:Investor)-[:INVESTED_IN]->(c:Company)-[:OPERATES_IN]->(d:Domain)<-[:OPERATES_IN]-(t:Company)
            WHERE c.id <> t.id
            RETURN i.name, t.name, d.name LIMIT 1
        `);

        if (resL1.records.length > 0) {
            const r = resL1.records[0];
            console.log("\n✅ LEVEL 1 MATCH FOUND:");
            console.log("Investor:", r.get('i.name'));
            console.log("Target:", r.get('t.name'));
            console.log("  (Shared Domain: " + r.get('d.name') + ")");
        } else {
            console.log("❌ No Level 1 conflicts found in current data.");
        }

    } catch (e) { console.error(e); }
    finally { await session.close(); driver.close(); }
}

findConfirm();
