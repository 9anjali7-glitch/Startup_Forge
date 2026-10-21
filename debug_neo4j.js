const neo4j = require('neo4j-driver');
const driver = neo4j.driver('bolt://localhost:7687', neo4j.auth.basic('neo4j', 'password'));
const session = driver.session();

async function debug() {
    try {
        console.log('--- User Debug ---');
        const user = await session.run("MATCH (u:Investor {id: '3'}) RETURN u.name, u.domain, u.id");
        if (user.records.length > 0) {
            console.log('User:', user.records[0].toObject());
        } else {
            console.log('User 3 (Mark Suster) not found');
        }

        console.log('\n--- Domain Debug ---');
        const domains = await session.run("MATCH (d:Domain) RETURN d.name LIMIT 5");
        domains.records.forEach(r => console.log('Domain:', r.get('d.name')));

        console.log('\n--- Link Debug ---');
        const links = await session.run("MATCH (c:Company)-[:OPERATES_IN]->(d:Domain) RETURN c.name, d.name LIMIT 5");
        links.records.forEach(r => console.log(r.get('c.name') + ' -> ' + r.get('d.name')));

        console.log('\n--- Count Debug ---');
        const cCount = await session.run("MATCH (c:Company) RETURN count(c) as count");
        console.log('Companies:', cCount.records[0].get('count').toInt());

        const dCount = await session.run("MATCH (d:Domain) RETURN count(d) as count");
        console.log('Domains:', dCount.records[0].get('count').toInt());

        // Check specific domain "Advertising"
        console.log('\n--- Advertising Debug ---');
        const adv = await session.run("MATCH (c:Company)-[:OPERATES_IN]->(d:Domain {name: 'Advertising'}) RETURN count(c) as count");
        console.log('Companies in Advertising:', adv.records[0].get('count').toInt());

    } catch (e) { console.error(e); }
    finally { await session.close(); await driver.close(); }
}
debug();
