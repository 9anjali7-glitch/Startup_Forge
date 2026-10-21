require('dotenv').config({ path: '../.env' });

const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
const neo4j = require('neo4j-driver');

const driver = neo4j.driver(
    process.env.NEO4J_URI || 'bolt://localhost:7687',
    neo4j.auth.basic(
        process.env.NEO4J_USER || 'neo4j',
        process.env.NEO4J_PASSWORD
    ),
    (process.env.NEO4J_URI || 'bolt://localhost:7687').startsWith('bolt')
        ? { encrypted: false }
        : {}
);

const FOUNDERS_CSV = path.join(__dirname, '../rag_backend/founders_cleaned.csv');
const INVESTORS_CSV = path.join(__dirname, '../rag_backend/investors_cleaned.csv');

function parsePythonLiteral(str) {
    if (!str || str === '[]' || str === '{}') return null;

    try {
        let jsonStr = str.replace(/'/g, '"');

        jsonStr = jsonStr
            .replace(/: ?True/g, ': true')
            .replace(/: ?False/g, ': false');

        return JSON.parse(jsonStr);
    } catch (e) {
        return null;
    }
}

function readCSV(filePath) {
    return new Promise((resolve, reject) => {
        const rows = [];

        fs.createReadStream(filePath)
            .pipe(csv())
            .on('data', row => rows.push(row))
            .on('end', () => resolve(rows))
            .on('error', reject);
    });
}

async function syncData() {
    const session = driver.session();

    try {
        console.log('🌱 Cleaning up old graph data...');

        await session.run('MATCH (n) DETACH DELETE n');

        // ============================================================
        // INVESTORS
        // ============================================================

        console.log('💸 Reading investors CSV...');

        const investors = await readCSV(INVESTORS_CSV);

        console.log(`   Parsed ${investors.length} investors.`);

        for (const inv of investors) {
            if (!inv.id || !inv.name) continue;

            const id = String(inv.id).trim();
            const name = String(inv.name).trim();
            const domain = inv.primary_domain
                ? String(inv.primary_domain).trim()
                : null;

            await session.run(
                `
                MERGE (i:Investor {id: $id})
                SET i.name = $name,
                    i.domain = $domain
                `,
                {
                    id,
                    name,
                    domain
                }
            );

            const investments = parsePythonLiteral(inv.past_investments);

            if (Array.isArray(investments)) {
                for (const investment of investments) {
                    if (!investment || !investment.company_name) continue;

                    const companyName = String(
                        investment.company_name
                    ).trim();

                    if (!companyName) continue;

                    await session.run(
                        `
                        MATCH (i:Investor {id: $id})

                        MERGE (c:Company {name: $companyName})

                        MERGE (i)-[:INVESTED_IN]->(c)

                        WITH i, c
                        WHERE i.domain IS NOT NULL
                          AND i.domain <> ""

                        MERGE (d:Domain {name: i.domain})

                        MERGE (c)-[:OPERATES_IN]->(d)
                        `,
                        {
                            id,
                            companyName
                        }
                    );
                }
            }
        }

        // ============================================================
        // FOUNDERS
        // ============================================================

        console.log('🏢 Reading founders CSV...');

        const founders = await readCSV(FOUNDERS_CSV);

        console.log(`   Parsed ${founders.length} founders.`);

        for (const f of founders) {
            if (!f.id || !f.company) continue;

            const id = String(f.id).trim();
            const companyName = String(f.company).trim();
            const founderName = f.name
                ? String(f.name).trim()
                : null;

            const domainName = f.domain
                ? String(f.domain).trim()
                : null;

            const valuation = parseFloat(f.valuation) || 0;

            const funding = parsePythonLiteral(f.past_funding);

            const round =
                funding && funding.round
                    ? String(funding.round)
                    : 'Seed';

            const year =
                funding && funding.year
                    ? Number(funding.year)
                    : parseInt(f.funding_year) || 2022;

            await session.run(
                `
                MERGE (c:Company {name: $companyName})

                SET c.id = $id,
                    c.founder = $founderName,
                    c.valuation = $valuation,
                    c.round = $round,
                    c.year = $year

                `,
                {
                    id,
                    companyName,
                    founderName,
                    valuation,
                    round,
                    year
                }
            );

            // ========================================================
            // UMBRELLA / PARENT COMPANIES
            // ========================================================

            const parents = parsePythonLiteral(f.umbrella_companies);

            if (Array.isArray(parents)) {
                for (const parent of parents) {
                    if (!parent) continue;

                    const parentName = String(parent).trim();

                    if (!parentName) continue;

                    await session.run(
                        `
                        MATCH (c:Company {name: $companyName})

                        MERGE (p:Company {name: $parentName})

                        MERGE (p)-[:HAS_SUBSIDIARY]->(c)
                        `,
                        {
                            companyName,
                            parentName
                        }
                    );
                }
            }

            // ========================================================
            // COMPETITORS
            // ========================================================

            const competitors = parsePythonLiteral(f.competitors);

            if (Array.isArray(competitors)) {
                for (const competitor of competitors) {
                    if (!competitor) continue;

                    const competitorName =
                        String(competitor).trim();

                    if (!competitorName) continue;

                    await session.run(
                        `
                        MATCH (c:Company {name: $companyName})

                        MERGE (comp:Company {name: $competitorName})

                        MERGE (c)-[:COMPETES_WITH]->(comp)
                        `,
                        {
                            companyName,
                            competitorName
                        }
                    );
                }
            }

            // ========================================================
            // DOMAIN
            // ========================================================

            if (domainName && !domainName.includes('.com')) {
                await session.run(
                    `
                    MATCH (c:Company {name: $companyName})

                    MERGE (d:Domain {name: $domainName})

                    MERGE (c)-[:OPERATES_IN]->(d)
                    `,
                    {
                        companyName,
                        domainName
                    }
                );
            }
        }

        console.log('✅ Data sync complete!');

    } catch (error) {
        console.error('❌ Sync failed:', error);
        process.exitCode = 1;
    } finally {
        await session.close();
        await driver.close();
    }
}

syncData();