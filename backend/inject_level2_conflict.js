
const neo4j = require('neo4j-driver');

const driver = neo4j.driver(
    'bolt://localhost:7687',
    neo4j.auth.basic('neo4j', 'password'),
    { encrypted: false }
);

const session = driver.session();

const injectData = async () => {
    try {
        console.log("💉 Injecting Level 2 Conflict Data...");

        await session.run(`
            // 1. Create the Investor
            MERGE (i:Investor {name: 'Risk Capital Partners'})
            SET i.id = 'inv_risk_cap'
            SET i.role = 'investor'

            // 2. Create the Target Company
            MERGE (target:Company {name: 'Safe Haven Tech'})
            SET target.id = 'cmp_safe_haven'
            MERGE (domain:Domain {name: 'Cybersecurity'})
            MERGE (target)-[:OPERATES_IN]->(domain)

            // 3. Create the Conflict Chain
            // Investor -> Invested in 'Big Parent Co'
            MERGE (parent:Company {name: 'Big Parent Co'})
            SET parent.id = 'cmp_big_parent'
            MERGE (i)-[:INVESTED_IN]->(parent)

            // 'Big Parent Co' -> Owns 'Aggressive Sub Inc'
            MERGE (sub:Company {name: 'Aggressive Sub Inc'})
            SET sub.id = 'cmp_aggr_sub'
            MERGE (parent)-[:HAS_SUBSIDIARY]->(sub)

            // 'Aggressive Sub Inc' -> Competes with Target
            MERGE (sub)-[:COMPETES_WITH]->(target)
            
            // Also ensure Sub operates in same domain to be realistic
            MERGE (sub)-[:OPERATES_IN]->(domain)
        `);

        console.log("✅ Injection Complete!");
        console.log("---------------------------------------------------");
        console.log("Test with:");
        console.log("Investor: Risk Capital Partners");
        console.log("Target:   Safe Haven Tech");
        console.log("---------------------------------------------------");
        console.log("Conflict Logic:");
        console.log("Risk Capital Partners -> Invested In -> Big Parent Co");
        console.log("Big Parent Co -> Has Subsidiary -> Aggressive Sub Inc");
        console.log("Aggressive Sub Inc -> Competes With -> Safe Haven Tech");

    } catch (error) {
        console.error("❌ Injection failed:", error);
    } finally {
        await session.close();
        await driver.close();
    }
};

injectData();
