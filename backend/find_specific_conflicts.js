const neo4j = require('neo4j-driver');

const driver = neo4j.driver(
    process.env.NEO4J_URI || 'bolt://localhost:7687',
    neo4j.auth.basic('neo4j', 'password'),
    { encrypted: false }
);

const findConflicts = async (targetName) => {
    const session = driver.session();
    try {
        console.log(`\n🔍 Finding conflicts for Target: "${targetName}"...`);

        // Check if target exists
        const checkRes = await session.run(
            `MATCH (c:Company) WHERE toLower(c.name) = toLower($name) RETURN c.name as name, c.domain as domain`,
            { name: targetName }
        );
        if (checkRes.records.length === 0) {
            console.log(`   ❌ Target company "${targetName}" found in database.`);
            return;
        }
        const realName = checkRes.records[0].get('name');
        console.log(`   ✅ Found Target: "${realName}" (Domain: ${checkRes.records[0].get('domain') || 'N/A'})`);

        // LEVEL 1: Investors who invested in SAME DOMAIN
        // (Investor)-[:INVESTED_IN]->(Other)-[:OPERATES_IN]->(Domain)<-[:OPERATES_IN]-(Target)
        // AND Other != Target
        const l1Query = `
            MATCH (target:Company {name: $realName})-[:OPERATES_IN]->(d:Domain)
            MATCH (other:Company)-[:OPERATES_IN]->(d)
            WHERE other.name <> target.name
            MATCH (inv:Investor)-[:INVESTED_IN]->(other)
            RETURN DISTINCT inv.name as investor, other.name as conflicting_company, d.name as domain
            LIMIT 3
        `;
        const l1Res = await session.run(l1Query, { realName });
        if (l1Res.records.length > 0) {
            console.log(`   🔸 Possible Level 1 Conflicts (Sector Overlap):`);
            l1Res.records.forEach(r => {
                console.log(`      - Investor: "${r.get('investor')}" (Invested in: "${r.get('conflicting_company')}" same domain "${r.get('domain')}")`);
            });
        } else {
            console.log(`   🔸 No Level 1 Conflicts found.`);
        }

        // LEVEL 2: Investors -> Parent -> Sub -[COMPETES]-> Target
        const l2Query = `
            MATCH (target:Company {name: $realName})
            MATCH (sub:Company)-[:COMPETES_WITH]->(target)
            MATCH (parent:Company)-[:HAS_SUBSIDIARY]->(sub)
            MATCH (inv:Investor)-[:INVESTED_IN]->(parent)
            RETURN DISTINCT inv.name as investor, parent.name as parent, sub.name as subsidiary
            LIMIT 3
        `;
        const l2Res = await session.run(l2Query, { realName });
        if (l2Res.records.length > 0) {
            console.log(`   🔴 Possible Level 2 Conflicts (Competitor Subsidiary):`);
            l2Res.records.forEach(r => {
                console.log(`      - Investor: "${r.get('investor')}" (Invested in Parent "${r.get('parent')}" owning Competitor "${r.get('subsidiary')}")`);
            });
        } else {
            console.log(`   🔴 No Level 2 Conflicts found.`);
        }

    } catch (err) {
        console.error("Error:", err);
    } finally {
        await session.close();
    }
};

const run = async () => {
    await findConflicts('1upHealth');
    await findConflicts('eQUINOR'); // Testing case insensitivity lookup
    await driver.close();
};

run();
