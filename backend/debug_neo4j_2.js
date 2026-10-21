const neo4j = require('neo4j-driver');
const driver = neo4j.driver('bolt://localhost:7687', neo4j.auth.basic('neo4j', 'password'));
const session = driver.session();

async function debug() {
    try {
        const domain = 'Advertising';
        console.log(`Checking Investors in domain: ${domain}`);

        // 1. Find Investors in Domain
        const investors = await session.run("MATCH (i:Investor {domain: $domain}) RETURN count(i) as count", { domain });
        console.log('Investors found:', investors.records[0].get('count').toInt());

        // 2. Find Companies via these Investors
        const query = `
        MATCH (i:Investor {domain: $domain})-[:INVESTED_IN]->(c:Company)
        WHERE c.founder IS NOT NULL
        RETURN count(c) as count, collect(c.name)[0..5] as content
    `;
        const comps = await session.run(query, { domain });
        console.log('Companies found:', comps.records[0].get('count').toInt());
        console.log('Sample companies:', comps.records[0].get('content'));

    } catch (e) { console.error(e); }
    finally { await session.close(); await driver.close(); }
}
debug();
