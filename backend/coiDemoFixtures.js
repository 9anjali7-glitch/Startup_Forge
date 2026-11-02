// Synthetic examples are created only when a demo scenario is explicitly checked.
// MERGE makes this safe to repeat after restarts without touching other graph data.
async function ensureCoiDemoFixtures(session) {
  await session.run(`
    MERGE (investor:Investor {id: 'demo-investor-jordan-lee'})
    SET investor.name = 'Jordan Lee (Demo Investor)', investor.firm_name = 'Northstar Capital (Demo)',
        investor.domain = 'Healthcare Technology', investor.demo_fixture = true
    MERGE (domain:Domain {name: 'Healthcare Technology'})
    MERGE (portfolio:Company {id: 'demo-direct-portfolio'})
    SET portfolio.name = 'Harbor Health Analytics', portfolio.domain = 'Healthcare Technology',
        portfolio.description = 'Synthetic healthcare data platform used as a direct conflict demo.', portfolio.demo_fixture = true
    MERGE (directTarget:Company {id: 'demo-direct-target'})
    SET directTarget.name = 'Northstar Care Systems', directTarget.domain = 'Healthcare Technology',
        directTarget.description = 'Synthetic target used to demonstrate a direct portfolio conflict.', directTarget.demo_fixture = true
    MERGE (investor)-[investment:INVESTED_IN]->(portfolio)
    SET investment.evidence_type = 'synthetic demo fixture', investment.notes = 'Illustrative demo relationship; not a real diligence finding.'
    MERGE (portfolio)-[:OPERATES_IN]->(domain)
    MERGE (directTarget)-[:OPERATES_IN]->(domain)
    MERGE (portfolio)-[direct:COMPETES_WITH]->(directTarget)
    SET direct.evidence_type = 'synthetic demo fixture', direct.notes = 'Illustrative direct competitor relationship; not a real-world finding.'

    MERGE (parent:Company {id: 'demo-indirect-parent'})
    SET parent.name = 'Summit Digital Holdings', parent.description = 'Synthetic holding company used for the indirect conflict demo.', parent.demo_fixture = true
    MERGE (subsidiary:Company {id: 'demo-indirect-subsidiary'})
    SET subsidiary.name = 'Summit Care Networks', subsidiary.domain = 'Healthcare Technology',
        subsidiary.description = 'Synthetic subsidiary used for the indirect conflict demo.', subsidiary.demo_fixture = true
    MERGE (indirectTarget:Company {id: 'demo-indirect-target'})
    SET indirectTarget.name = 'Cedarline Health', indirectTarget.domain = 'Healthcare Technology',
        indirectTarget.description = 'Synthetic target used to demonstrate an indirect ownership conflict.', indirectTarget.demo_fixture = true
    MERGE (investor)-[parentInvestment:INVESTED_IN]->(parent)
    SET parentInvestment.evidence_type = 'synthetic demo fixture', parentInvestment.notes = 'Illustrative demo relationship; not a real diligence finding.'
    MERGE (parent)-[ownership:HAS_SUBSIDIARY]->(subsidiary)
    SET ownership.evidence_type = 'synthetic demo fixture'
    MERGE (subsidiary)-[indirect:COMPETES_WITH]->(indirectTarget)
    SET indirect.evidence_type = 'synthetic demo fixture', indirect.notes = 'Illustrative indirect competitor relationship; not a real-world finding.'

    MERGE (sectorPortfolio:Company {id: 'demo-sector-portfolio'})
    SET sectorPortfolio.name = 'Meridian Claims Data', sectorPortfolio.domain = 'Healthcare Technology',
        sectorPortfolio.description = 'Synthetic portfolio company used for a same-sector screening example.', sectorPortfolio.demo_fixture = true
    MERGE (sectorTarget:Company {id: 'demo-sector-target'})
    SET sectorTarget.name = 'Bluewater Patient Systems', sectorTarget.domain = 'Healthcare Technology',
        sectorTarget.description = 'Synthetic target used for a same-sector screening example.', sectorTarget.demo_fixture = true
    MERGE (investor)-[sectorInvestment:INVESTED_IN]->(sectorPortfolio)
    SET sectorInvestment.evidence_type = 'synthetic demo fixture', sectorInvestment.notes = 'Illustrative demo relationship; not a real diligence finding.'
    MERGE (sectorPortfolio)-[:OPERATES_IN]->(domain)
    MERGE (sectorTarget)-[:OPERATES_IN]->(domain)
  `);
}

async function ensureCoiPublicExamples(session) {
  await session.run(`
    MERGE (berkshire:Investor {id: 'public-example-berkshire-hathaway'})
    SET berkshire.name = 'Berkshire Hathaway Inc. (Public Example)',
        berkshire.firm_name = 'Berkshire Hathaway Inc.', berkshire.domain = 'Diversified Holdings',
        berkshire.demo_fixture = true, berkshire.demo_kind = 'public-source example',
        berkshire.profile_image_url = 'https://thumb.wikimedia.org/wikipedia/commons/thumb/6/6e/Berkshire-Hathaway-Logo.svg/960px-Berkshire-Hathaway-Logo.svg.png',
        berkshire.website = 'https://www.berkshirehathaway.com/',
        berkshire.headquarters = 'Omaha, Nebraska, United States',
        berkshire.profile_summary = 'Diversified holding company; public equity positions are reported periodically in SEC filings.'
    MERGE (apple:Company {id: 'public-example-apple'})
    SET apple.name = 'Apple Inc.', apple.domain = 'Consumer Electronics', apple.demo_fixture = true,
        apple.demo_kind = 'public-source example', apple.website = 'https://www.apple.com/',
        apple.profile_summary = 'Publicly traded technology company; SEC records report Berkshire equity holdings.'
    MERGE (samsung:Company {id: 'public-example-samsung'})
    SET samsung.name = 'Samsung Electronics Co., Ltd.', samsung.domain = 'Consumer Electronics',
        samsung.demo_fixture = true, samsung.demo_kind = 'public-source example', samsung.website = 'https://www.samsung.com/'
    MERGE (berkshire)-[bhApple:INVESTED_IN]->(apple)
    SET bhApple.evidence_type = 'public-source example; SEC 13F reported 2026-06-30',
        bhApple.source_url = 'https://www.sec.gov/Archives/edgar/data/1067983/000119312526352200/0001193125-26-352200-index.htm',
        bhApple.source_as_of = '2026-06-30',
        bhApple.notes = 'The SEC 2026 Q2 13F information table reports Berkshire holdings of 227,917,808 Apple shares as of June 30, 2026. A quarterly reported position, not a live holdings feed.'
    MERGE (apple)-[appleSamsung:COMPETES_WITH]->(samsung)
    SET appleSamsung.evidence_type = 'public-source example; Samsung filing dated 2026-03-12',
        appleSamsung.source_url = 'https://www1.hkexnews.hk/listedco/listconews/sehk/2026/0312/2026031200834.pdf',
        appleSamsung.source_as_of = '2026-03-12',
        appleSamsung.notes = 'Samsung identifies Apple as a competitor in mobile phones in its 2026 filing.'

    MERGE (beats:Company {id: 'public-example-beats-electronics'})
    SET beats.name = 'Beats Electronics', beats.domain = 'Consumer Audio', beats.demo_fixture = true,
        beats.demo_kind = 'public-source example', beats.website = 'https://www.beatsbydre.com/'
    MERGE (bose:Company {id: 'public-example-bose'})
    SET bose.name = 'Bose Corporation', bose.domain = 'Consumer Audio', bose.demo_fixture = true,
        bose.demo_kind = 'public-source example', bose.website = 'https://www.bose.com/'
    MERGE (apple)-[appleBeats:HAS_SUBSIDIARY]->(beats)
    SET appleBeats.evidence_type = 'public-source example; Beats company profile says acquired July 2014',
        appleBeats.source_url = 'https://www.beatsbydre.com/company/aboutus',
        appleBeats.source_as_of = '2014-07',
        appleBeats.notes = 'Beats’ official company profile states Apple acquired Beats in July 2014.'
    MERGE (beats)-[beatsBose:COMPETES_WITH]->(bose)
    SET beatsBose.evidence_type = 'public-source example; European Commission market evidence dated 2014-07-25',
        beatsBose.source_url = 'https://ec.europa.eu/competition/mergers/cases/decisions/m7290_20140725_20310_3804651_EN.pdf',
        beatsBose.source_as_of = '2014-07-25',
        beatsBose.notes = 'The Commission decision describes Bose products as closer in price and features to Beats than Apple’s products in the assessed headphone market. Historical market evidence; current overlap may differ.'
  `);
}

module.exports = { ensureCoiDemoFixtures, ensureCoiPublicExamples };
