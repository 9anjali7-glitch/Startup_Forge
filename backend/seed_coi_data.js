require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const neo4j = require('neo4j-driver');

// Safe, repeatable demo fixture seeder. It only merges these named fixture nodes;
// it never deletes or resets the user's Neo4j database.
const uri = process.env.NEO4J_URI || 'bolt://localhost:7687';
const driver = neo4j.driver(
    uri,
    neo4j.auth.basic(process.env.NEO4J_USER || 'neo4j', process.env.NEO4J_PASSWORD || 'password'),
    uri.startsWith('bolt') ? { encrypted: false } : {}
);

async function seedDemoConflicts() {
    const session = driver.session();
    try {
        await session.run(`
            MERGE (investor:Investor {id: 'demo-investor-jordan-lee'})
            SET investor.name = 'Jordan Lee (Demo Investor)',
                investor.firm_name = 'Northstar Capital (Demo)',
                investor.domain = 'Healthcare Technology',
                investor.demo_fixture = true

            MERGE (domain:Domain {name: 'Healthcare Technology'})
            MERGE (portfolio:Company {id: 'demo-direct-portfolio'})
            SET portfolio.name = 'Harbor Health Analytics',
                portfolio.domain = 'Healthcare Technology',
                portfolio.description = 'Synthetic healthcare data platform used as a direct competitor fixture.',
                portfolio.demo_fixture = true
            MERGE (directTarget:Company {id: 'demo-direct-target'})
            SET directTarget.name = 'Northstar Care Systems',
                directTarget.domain = 'Healthcare Technology',
                directTarget.description = 'Synthetic target company for the direct portfolio conflict demo.',
                directTarget.demo_fixture = true
            MERGE (investor)-[:INVESTED_IN {evidence_type: 'synthetic demo fixture', notes: 'Seeded only to demonstrate an explicit portfolio relationship.'}]->(portfolio)
            MERGE (portfolio)-[:OPERATES_IN]->(domain)
            MERGE (directTarget)-[:OPERATES_IN]->(domain)
            MERGE (portfolio)-[directCompetition:COMPETES_WITH]->(directTarget)
            SET directCompetition.evidence_type = 'synthetic demo fixture',
                directCompetition.notes = 'Illustrative direct competitor relationship; not a real-world diligence finding.'

            MERGE (parent:Company {id: 'demo-indirect-parent'})
            SET parent.name = 'Summit Digital Holdings',
                parent.description = 'Synthetic holding company used for the indirect conflict demo.',
                parent.demo_fixture = true
            MERGE (subsidiary:Company {id: 'demo-indirect-subsidiary'})
            SET subsidiary.name = 'Summit Care Networks',
                subsidiary.domain = 'Healthcare Technology',
                subsidiary.description = 'Synthetic subsidiary used for the indirect conflict demo.',
                subsidiary.demo_fixture = true
            MERGE (indirectTarget:Company {id: 'demo-indirect-target'})
            SET indirectTarget.name = 'Cedarline Health',
                indirectTarget.domain = 'Healthcare Technology',
                indirectTarget.description = 'Synthetic target company for the indirect ownership demo.',
                indirectTarget.demo_fixture = true
            MERGE (investor)-[:INVESTED_IN {evidence_type: 'synthetic demo fixture', notes: 'Seeded only to demonstrate parent-company exposure.'}]->(parent)
            MERGE (parent)-[ownership:HAS_SUBSIDIARY]->(subsidiary)
            SET ownership.evidence_type = 'synthetic demo fixture'
            MERGE (subsidiary)-[indirectCompetition:COMPETES_WITH]->(indirectTarget)
            SET indirectCompetition.evidence_type = 'synthetic demo fixture',
                indirectCompetition.notes = 'Illustrative indirect competitor relationship; not a real-world diligence finding.'
            // Public-source screening examples. These use dated public filings and
            // should be reviewed as potential graph paths, not actual COI findings.
            MERGE (berkshire:Investor {id: 'public-example-berkshire-hathaway'})
            SET berkshire.name = 'Berkshire Hathaway Inc. (Public Example)',
                berkshire.firm_name = 'Berkshire Hathaway Inc.',
                berkshire.domain = 'Diversified Holdings',
                berkshire.demo_fixture = true,
                berkshire.demo_kind = 'public-source example',
                berkshire.profile_image_url = 'https://thumb.wikimedia.org/wikipedia/commons/thumb/6/6e/Berkshire-Hathaway-Logo.svg/960px-Berkshire-Hathaway-Logo.svg.png',
                berkshire.website = 'https://www.berkshirehathaway.com/',
                berkshire.tickers = 'NYSE: BRK.A, BRK.B',
                berkshire.headquarters = 'Omaha, Nebraska, United States',
                berkshire.profile_summary = 'Diversified holding company with operations in insurance and reinsurance, utilities and energy, freight rail, manufacturing, services, and retail.',
                berkshire.profile_source = 'https://www.berkshirehathaway.com/news/may0525.pdf',
                berkshire.ceo = 'Gregory E. Abel (CEO since 2026-01-01)',
                berkshire.board_chair = 'Howard G. Buffett (elected 2026-09-18)',
                berkshire.leadership_source = 'https://www.berkshirehathaway.com/news/sep1826.pdf',
                berkshire.profile_last_verified = '2026-11-01',
                berkshire.apple_shares_reported = 227917808,
                berkshire.apple_position_value_usd_reported = 65950296923,
                berkshire.apple_position_report_date = '2026-06-30'
            MERGE (apple:Company {id: 'public-example-apple'})
            SET apple.name = 'Apple Inc.',
                apple.domain = 'Consumer Electronics',
                apple.demo_fixture = true,
                apple.demo_kind = 'public-source example',
                apple.profile_image_url = 'https://www.google.com/s2/favicons?domain=apple.com&sz=128',
                apple.website = 'https://www.apple.com/',
                apple.profile_summary = 'Publicly traded consumer technology company; connected here only as a reported Berkshire equity holding and as the parent that announced acquiring Beats Electronics.'
            MERGE (samsung:Company {id: 'public-example-samsung'})
            SET samsung.name = 'Samsung Electronics Co., Ltd.',
                samsung.domain = 'Consumer Electronics',
                samsung.demo_fixture = true,
                samsung.demo_kind = 'public-source example',
                samsung.profile_image_url = 'https://www.google.com/s2/favicons?domain=samsung.com&sz=128',
                samsung.website = 'https://www.samsung.com/',
                samsung.profile_summary = 'Publicly traded consumer electronics manufacturer; the cited Samsung filing identifies Apple as a mobile-phone competitor.'
            MERGE (berkshire)-[bhApple:INVESTED_IN]->(apple)
            SET bhApple.evidence_type = 'public-source demo example; reported 2026-06-30',
                bhApple.source_url = 'https://www.sec.gov/Archives/edgar/data/1067983/000119312526352200/0001193125-26-352200-index.htm',
                bhApple.source_as_of = '2026-06-30',
                bhApple.notes = 'Berkshire 2026 Q2 Form 13F-HR reports 227,917,808 Apple shares with a filed value of USD 65,950,296,923 as of 2026-06-30; this is not a live position feed.'
            MERGE (apple)-[appleSamsung:COMPETES_WITH]->(samsung)
            SET appleSamsung.evidence_type = 'public-source demo example; reported 2026-03-12',
                appleSamsung.source_url = 'https://www1.hkexnews.hk/listedco/listconews/sehk/2026/0312/2026031200834.pdf',
                appleSamsung.source_as_of = '2026-03-12',
                appleSamsung.notes = 'Samsung Electronics identifies Apple as a competitor in its mobile phone business in this filing.'

            MERGE (beats:Company {id: 'public-example-beats-electronics'})
            SET beats.name = 'Beats Electronics',
                beats.domain = 'Consumer Audio',
                beats.demo_fixture = true,
                beats.demo_kind = 'public-source example',
                beats.profile_image_url = 'https://www.google.com/s2/favicons?domain=beatsbydre.com&sz=128',
                beats.website = 'https://www.beatsbydre.com/',
                beats.profile_summary = 'Consumer audio brand within the Apple and Beats Electronics ownership chain described in Apple’s 2014 acquisition announcement.'
            MERGE (bose:Company {id: 'public-example-bose'})
            SET bose.name = 'Bose Corporation',
                bose.domain = 'Consumer Audio',
                bose.demo_fixture = true,
                bose.demo_kind = 'public-source example',
                bose.profile_image_url = 'https://www.google.com/s2/favicons?domain=bose.com&sz=128',
                bose.website = 'https://www.bose.com/',
                bose.profile_summary = 'Consumer audio company used as a target in the dated Beats headphone-market screening example.'
            MERGE (apple)-[appleBeats:HAS_SUBSIDIARY]->(beats)
            SET appleBeats.evidence_type = 'public-source demo example; acquisition announced 2014-05-28',
                appleBeats.source_url = 'https://www.apple.com/gr/newsroom/2014/05/28Apple-to-Acquire-Beats-Music-Beats-Electronics/',
                appleBeats.source_as_of = '2014-05-28',
                appleBeats.notes = 'Apple announced its acquisition of Beats Electronics. This historical ownership relationship should be rechecked before operational use.'
            MERGE (beats)-[beatsBose:COMPETES_WITH]->(bose)
            SET beatsBose.evidence_type = 'public-source demo example; market evidence 2014',
                beatsBose.source_url = 'https://ec.europa.eu/competition/mergers/cases/decisions/m7290_20140725_20310_3804651_EN.pdf',
                beatsBose.source_as_of = '2014-07-25',
                beatsBose.notes = 'European Commission merger decision describes Bose as a manufacturer whose headphone prices/features were closer to Beats than Apple products. This is dated market evidence; verify current product overlap.'

            MERGE (berkshire)-[bhAppleIndirect:INVESTED_IN]->(apple)
            SET bhAppleIndirect.evidence_type = 'public-source demo example; reported 2026-06-30',
                bhAppleIndirect.source_url = 'https://www.sec.gov/Archives/edgar/data/1067983/000119312526352200/0001193125-26-352200-index.htm',
                bhAppleIndirect.source_as_of = '2026-06-30',
                bhAppleIndirect.notes = 'Berkshire 2026 Q2 Form 13F-HR reports 227,917,808 Apple shares with a filed value of USD 65,950,296,923 as of 2026-06-30; a dated snapshot only.'
        `);
        console.log('Conflict examples are ready: two synthetic graph fixtures and two public-source screening examples.');
        console.log('  Direct: Jordan Lee (Demo Investor) -> Harbor Health Analytics -> Northstar Care Systems');
        console.log('  Indirect: Jordan Lee (Demo Investor) -> Summit Digital Holdings -> Summit Care Networks -> Cedarline Health');
        console.log('  Public-source direct screening example: Berkshire Hathaway -> Apple -> Samsung Electronics');
        console.log('  Public-source indirect screening example: Berkshire Hathaway -> Apple -> Beats Electronics -> Bose');
    } catch (error) {
        console.error('Demo fixture seeding failed:', error.message);
        process.exitCode = 1;
    } finally {
        await session.close();
        await driver.close();
    }
}

seedDemoConflicts();
