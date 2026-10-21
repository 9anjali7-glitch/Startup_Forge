const neo4j = require('neo4j-driver');

const driver = neo4j.driver(
    'bolt://localhost:7687',
    neo4j.auth.basic('neo4j', 'password'),
    { encrypted: false }
);

async function debug() {
    const session = driver.session();
    try {
        console.log("🔍 Debugging Neo4j Data for COI...");

        const investorName = "Mark Suster";
        const targetCompany = "Kapital";

        // 1. Check Investor Node
        const invCheck = await session.run(`MATCH (i:Investor {name: $name}) RETURN i`, { name: investorName });
        if (invCheck.records.length === 0) {
            console.log(`❌ Investor '${investorName}' NOT FOUND.`);
            // Try case insensitive
            const invCheck2 = await session.run(`MATCH (i:Investor) WHERE toLower(i.name) = toLower($name) RETURN i.name`, { name: investorName });
            console.log(`   Case-insensitive match: ${invCheck2.records.length > 0 ? invCheck2.records[0].get(0) : "None"}`);
        } else {
            console.log(`✅ Investor '${investorName}' found.`);
        }

        // 2. Check Target Company Node
        const compCheck = await session.run(`MATCH (c:Company {name: $name}) RETURN c`, { name: targetCompany });
        if (compCheck.records.length === 0) {
            console.log(`❌ Company '${targetCompany}' NOT FOUND.`);
            // Try case insensitive
            const compCheck2 = await session.run(`MATCH (c:Company) WHERE toLower(c.name) = toLower($name) RETURN c.name`, { name: targetCompany });
            console.log(`   Case-insensitive match: ${compCheck2.records.length > 0 ? compCheck2.records[0].get(0) : "None"}`);
        } else {
            console.log(`✅ Company '${targetCompany}' found.`);
        }

        // 3. Check Relationships for Level 1 (Domain Overlap)
        // Investor -> Company -> Domain
        const domQuery = `
            MATCH (i:Investor {name: $investorName})-[:INVESTED_IN]->(c:Company)-[:OPERATES_IN]->(d:Domain)
            RETURN count(d) as domain_count, collect(DISTINCT d.name) as domains
        `;
        const domRes = await session.run(domQuery, { investorName });
        console.log(`📊 Investor Domains (via Portfolio):`, domRes.records[0].get('domains'));

        // Target -> Domain
        const targetDomQuery = `
            MATCH (c:Company {name: $targetName})-[:OPERATES_IN]->(d:Domain)
            RETURN d.name as domain
        `;
        const targetDomRes = await session.run(targetDomQuery, { targetName: targetCompany });
        if (targetDomRes.records.length > 0) {
            console.log(`🎯 Target Company Domain:`, targetDomRes.records.map(r => r.get('domain')));
        } else {
            console.log(`❌ Target Company has no 'OPERATES_IN' Domain relationship.`);
        }

        // 4. Check Level 2 (Parent/Subsidiary)
        // Does Mark Suster invest in anyone?
        const portQuery = `MATCH (i:Investor {name: $investorName})-[:INVESTED_IN]->(c:Company) RETURN count(c) as count, collect(c.name)[0..5] as sample`;
        const portRes = await session.run(portQuery, { investorName });
        console.log(`💼 Investor Portfolio Size: ${portRes.records[0].get('count')} (Sample: ${portRes.records[0].get('sample')})`);

    } catch (e) {
        console.error("Error:", e);
    } finally {
        await session.close();
        await driver.close();
    }
}

debug();
