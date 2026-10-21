const neo4j = require('neo4j-driver');

const driver = neo4j.driver(
    process.env.NEO4J_URI || "bolt://localhost:7687",
    neo4j.auth.basic("neo4j", "password")
);

const findExamples = async () => {
    const session = driver.session();
    try {
        console.log("🔍 Searching for COI Examples...");

        // 1. Find Level 1 Example (Sector Overlap)
        // Investor -> InvestedIn -> Company -> OperatesIn -> Domain <- OperatesIn <- Target
        const lvl1Query = `
            MATCH (i:Investor)-[:INVESTED_IN]->(c1:Company)-[:OPERATES_IN]->(d:Domain)<-[:OPERATES_IN]-(target:Company)
            WHERE c1 <> target
            RETURN i.name AS investor, target.name AS target, d.name AS domain
            LIMIT 5
        `;
        const lvl1Res = await session.run(lvl1Query);
        console.log(`\n✅ Level 1 Examples (Sector Overlap):`);
        if (lvl1Res.records.length > 0) {
            lvl1Res.records.forEach(r => {
                console.log(`   - Investor: "${r.get('investor')}" | Target: "${r.get('target')}" | Domain: "${r.get('domain')}"`);
            });
        } else {
            console.log("   ❌ No Level 1 examples found.");
        }

        // 2. Find Level 2 Example (Ownership + Competition)
        // Investor -> InvestedIn -> Parent -> HasSubsidiary -> Sub -> CompetesWith -> Target
        const lvl2Query = `
            MATCH (i:Investor)-[:INVESTED_IN]->(parent:Company)-[:HAS_SUBSIDIARY]->(sub:Company)-[:COMPETES_WITH]->(target:Company)
            RETURN i.name AS investor, target.name AS target, parent.name AS parent, sub.name AS sub
            LIMIT 5
        `;
        const lvl2Res = await session.run(lvl2Query);
        console.log(`\n✅ Level 2 Examples (Structure & Competition):`);
        if (lvl2Res.records.length > 0) {
            lvl2Res.records.forEach(r => {
                console.log(`   - Investor: "${r.get('investor')}" | Target: "${r.get('target')}" | Via: ${r.get('parent')} -> ${r.get('sub')}`);
            });
        } else {
            console.log("   ❌ No Level 2 examples found.");
        }

        // 3. Find BOTH (Intersection)
        // Matches correct patterns for both
        const bothQuery = `
            MATCH (i:Investor)-[:INVESTED_IN]->(c1:Company)-[:OPERATES_IN]->(d:Domain)<-[:OPERATES_IN]-(target:Company)
            WHERE c1 <> target
            WITH i, target, d
            MATCH (i)-[:INVESTED_IN]->(parent:Company)-[:HAS_SUBSIDIARY]->(sub:Company)-[:COMPETES_WITH]->(target)
            RETURN i.name AS investor, target.name AS target, d.name AS domain, parent.name AS parent
            LIMIT 5
        `;
        const bothRes = await session.run(bothQuery);
        console.log(`\n✅ BOTH Level 1 & 2 Examples:`);
        if (bothRes.records.length > 0) {
            bothRes.records.forEach(r => {
                console.log(`   - Investor: "${r.get('investor')}" | Target: "${r.get('target')}"`);
            });
        } else {
            console.log("   ⚠️ No examples found that satisfy BOTH conditions simultaneously.");
        }

    } catch (err) {
        console.error("Error finding examples:", err);
    } finally {
        await session.close();
        await driver.close();
    }
};

findExamples();
