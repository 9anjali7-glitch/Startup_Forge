const neo4j = require('neo4j-driver');

// Use the credentials provided by the user
const driver = neo4j.driver(
    'bolt://localhost:7687',
    neo4j.auth.basic('neo4j', 'password'),
    { encrypted: false }
);

const session = driver.session();

const seedData = async () => {
    try {
        console.log("🌱 Cleaning up old data...");
        await session.run('MATCH (n) DETACH DELETE n');

        console.log("🌱 Seeding COI Graph Data...");

        // 1. Create Investor (You)
        // 2. Create Target Company (The one you are checking)
        // 3. Create Conflict Scenario 1: Same Domain (Direct)
        // 4. Create Conflict Scenario 2: Subsidiary Competitor (Indirect)

        await session.run(`
      // Create Core Entities
      CREATE (me:Investor {id: 'inv_demo', name: 'Demo Investor'})
      CREATE (target:Company {id: 'cmp_demo', name: 'Acme Targets Inc.'})
      CREATE (domainA:Domain {name: 'Artificial Intelligence'})
      
      // Target operates in AI
      CREATE (target)-[:OPERATES_IN]->(domainA)

      // --- Scenario 1: Level 1 Conflict (Same Domain) ---
      // Investor invested in "Competitor A", who also operates in AI
      CREATE (compA:Company {id: 'cmp_a', name: 'Direct Competitor AI'})
      CREATE (compA)-[:OPERATES_IN]->(domainA)
      CREATE (me)-[:INVESTED_IN]->(compA)

      // --- Scenario 2: Level 2 Conflict (Subsidiary) ---
      // Investor invested in "Big Corp"
      // "Big Corp" owns "Little Corp"
      // "Little Corp" competes with "Acme Targets Inc."
      
      CREATE (bigCorp:Company {id: 'cmp_big', name: 'Big Holding Corp'})
      CREATE (littleCorp:Company {id: 'cmp_small', name: 'Aggressive Subsidiary Ltd'})
      
      CREATE (me)-[:INVESTED_IN]->(bigCorp)
      CREATE (bigCorp)-[:HAS_SUBSIDIARY]->(littleCorp)
      CREATE (littleCorp)-[:COMPETES_WITH]->(target)
      
      RETURN me, target
    `);

        console.log("✅ Database seeded successfully!");
        console.log("   - Investor: Demo Investor (id: inv_demo)");
        console.log("   - Target: Acme Targets Inc. (id: cmp_demo)");
        console.log("   - Level 1 Conflict: via 'Direct Competitor AI'");
        console.log("   - Level 2 Conflict: via 'Big Holding Corp' -> 'Aggressive Subsidiary Ltd'");

    } catch (error) {
        console.error("❌ Seeding failed:", error);
    } finally {
        await session.close();
        await driver.close();
    }
};

seedData();
