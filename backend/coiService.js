const express = require('express');
const neo4j = require('neo4j-driver');

const router = express.Router();

const uri = process.env.NEO4J_URI || 'bolt://host.docker.internal:7687';
const driver = neo4j.driver(
    uri,
    neo4j.auth.basic(process.env.NEO4J_USER || "neo4j", process.env.NEO4J_PASSWORD || "password"),
    uri.startsWith('bolt') ? { encrypted: false } : {}
);

function buildGraph(investor, target, paths, level) {
    const nodes = new Map();
    const edges = [];
    const addNode = (id, label, type) => {
        if (!nodes.has(id)) nodes.set(id, { id, label, type });
    };
    addNode("investor", investor, "investor");
    addNode("target", target, "target");
    paths.forEach((path, index) => {
        const entity = level === 2 ? path.parent : path.portfolio;
        const entityId = `company-${index}`;
        addNode(entityId, entity, "company");
        edges.push({ from: "investor", to: entityId, relation: "INVESTED_IN", ...(path.investment || {}) });
        if (level === 2) {
            const subsidiaryId = `subsidiary-${index}`;
            addNode(subsidiaryId, path.subsidiary, "company");
            edges.push({ from: entityId, to: subsidiaryId, relation: "HAS_SUBSIDIARY", ...(path.ownership || {}) });
            edges.push({ from: subsidiaryId, to: "target", relation: "COMPETES_WITH", ...(path.competition || {}) });
        } else {
            if (path.relationship === "SHARES_SECTOR") {
                const sectorId = `sector-${index}`;
                addNode(sectorId, path.competition?.sector || "Shared sector", "sector");
                edges.push({ from: entityId, to: sectorId, relation: "OPERATES_IN", evidence_type: path.competition?.evidence_type });
                edges.push({ from: "target", to: sectorId, relation: "OPERATES_IN", evidence_type: path.competition?.evidence_type });
            } else {
                edges.push({
                    from: entityId,
                    to: "target",
                    relation: path.relationship || "COMPETES_WITH",
                    ...(path.competition || {})
                });
            }
        }
    });
    return { nodes: [...nodes.values()], edges };
}

router.post("/check", async (req, res) => {
    const { investorName, targetCompany } = req.body;

    if (!investorName || !targetCompany) {
        return res.status(400).json({
            error: "investorName and targetCompany are required"
        });
    }

    const session = driver.session();

    try {
        /* ======================================================
           🔴 LEVEL 2 — HARD COI (DERIVED: Parent + Competition)
           ====================================================== */

        const level2Query = `
      MATCH (i:Investor) WHERE toLower(i.name) = toLower($investorName)
      MATCH (target:Company) WHERE toLower(target.name) = toLower($targetCompany)
      MATCH (i)-[investment:INVESTED_IN]->(parent:Company)
            -[ownership:HAS_SUBSIDIARY]->(sub:Company)
            -[competition:COMPETES_WITH]->(target)
      RETURN DISTINCT
        parent.name AS invested_parent,
        sub.name AS competing_subsidiary,
        properties(investment) AS investment_properties,
        properties(ownership) AS ownership_properties,
        properties(competition) AS competition_properties
    `;

        const level2Result = await session.run(level2Query, {
            investorName,
            targetCompany
        });

        if (level2Result.records.length > 0) {
            const isPublicSource = level2Result.records.some(r => String(r.get("competition_properties")?.evidence_type || "").includes("public-source demo example"));
            const isSynthetic = level2Result.records.some(r => ["investment_properties", "ownership_properties", "competition_properties"].some(key => String(r.get(key)?.evidence_type || "").includes("synthetic demo fixture")));
            return res.json({
                hasConflict: true,
                conflictLevel: 2,
                conflictType: "indirect ownership + competition",
                confidence: isPublicSource ? "dated public-source path; confirm current ownership and market overlap" : "derived",
                score: isPublicSource ? 45 : 90,
                investor: investorName,
                targetCompany,
                conflicts: level2Result.records.map(r => ({
                    investedParent: r.get("invested_parent"),
                    competingSubsidiary: r.get("competing_subsidiary"),
                    evidenceType: r.get("competition_properties")?.evidence_type || "recorded graph relationship",
                    notes: r.get("competition_properties")?.notes || null,
                    sourceUrl: r.get("competition_properties")?.source_url || null,
                    sourceDate: r.get("competition_properties")?.source_as_of || r.get("competition_properties")?.source_date || null
                })),
                graph: buildGraph(investorName, targetCompany, level2Result.records.map(r => ({
                    parent: r.get("invested_parent"),
                    subsidiary: r.get("competing_subsidiary"),
                    investment: r.get("investment_properties") || {},
                    ownership: r.get("ownership_properties") || {},
                    competition: r.get("competition_properties") || {}
                })), 2),
                dataClassification: isSynthetic ? "synthetic demo fixture" : isPublicSource ? "public-source demo example" : "StartupForge relationship graph",
                reason:
                    "A recorded graph path connects the investor to a parent and subsidiary with a competitor relationship. Treat this as a potential screening signal; verify current holdings, ownership, and market overlap."
            });
        }

        // Level 1: explicitly recorded portfolio company competition.
        const directResult = await session.run(`
      MATCH (i:Investor) WHERE toLower(i.name) = toLower($investorName)
      MATCH (target:Company) WHERE toLower(target.name) = toLower($targetCompany)
      MATCH (i)-[investment:INVESTED_IN]->(portfolio:Company)-[competition:COMPETES_WITH]->(target)
      RETURN DISTINCT portfolio.name AS portfolio_company,
        properties(investment) AS investment_properties,
        properties(competition) AS competition_properties,
        i.demo_fixture AS investor_demo,
        target.demo_fixture AS target_demo
    `, { investorName, targetCompany });

        if (directResult.records.length > 0) {
            const isPublicSource = directResult.records.some(r => String(r.get("competition_properties")?.evidence_type || "").includes("public-source demo example"));
            const isSynthetic = directResult.records.some(r => String(r.get("competition_properties")?.evidence_type || "").includes("synthetic demo fixture"));
            return res.json({
                hasConflict: true,
                conflictLevel: 1,
                conflictType: "direct portfolio competition",
                confidence: isPublicSource ? "publicly sourced relationship path; verify current status" : "recorded relationship",
                score: isPublicSource ? 55 : 90,
                investor: investorName,
                targetCompany,
                conflictingCompanies: directResult.records.map(r => r.get("portfolio_company")),
                evidence: directResult.records.map(r => ({
                    portfolioCompany: r.get("portfolio_company"),
                    relationship: "COMPETES_WITH",
                    evidenceType: r.get("competition_properties")?.evidence_type || "recorded graph relationship",
                    notes: r.get("competition_properties")?.notes || null,
                    sourceUrl: r.get("competition_properties")?.source_url || null,
                    sourceDate: r.get("competition_properties")?.source_as_of || r.get("competition_properties")?.source_date || null
                })),
                graph: buildGraph(investorName, targetCompany, directResult.records.map(r => ({
                    portfolio: r.get("portfolio_company"),
                    investment: r.get("investment_properties") || {},
                    competition: r.get("competition_properties") || {}
                })), 1),
                dataClassification: isSynthetic || directResult.records.some(r => r.get("investor_demo") || r.get("target_demo")) ? "synthetic demo fixture" : isPublicSource ? "public-source demo example" : "StartupForge relationship graph",
                reason: "A recorded portfolio path connects the investor to a company with a competitor relationship to the target. Treat this as a potential screening signal; verify the source, current exposure, and market overlap."
            });
        }

        /* ======================================================
           🟡 SCREENING SIGNAL — SECTOR OVERLAP
           ====================================================== */

        const level1Query = `
      MATCH (i:Investor) WHERE toLower(i.name) = toLower($investorName)
      MATCH (target:Company) WHERE toLower(target.name) = toLower($targetCompany)
      MATCH (i)-[:INVESTED_IN]->(c1:Company)-[:OPERATES_IN]->(s:Domain)
      MATCH (target)-[:OPERATES_IN]->(s)
      WHERE c1.name <> target.name
      RETURN
        s.name AS sector,
        collect(DISTINCT c1.name) AS conflicting_companies,
        i.demo_fixture AS investor_demo,
        target.demo_fixture AS target_demo
    `;

        const level1Result = await session.run(level1Query, {
            investorName,
            targetCompany
        });

        if (level1Result.records.length > 0) {
            const record = level1Result.records[0];
            return res.json({
                hasConflict: true,
                conflictLevel: 1,
                conflictType: "sector overlap screening signal",
                confidence: "inferred from shared sector",
                score: 55,
                dataClassification: record.get("investor_demo") || record.get("target_demo") ? "synthetic demo fixture" : "StartupForge relationship graph",
                investor: investorName,
                targetCompany,
                sector: record.get("sector"),
                conflictingCompanies: record.get("conflicting_companies"),
                graph: buildGraph(investorName, targetCompany, (record.get("conflicting_companies") || []).map(company => ({ portfolio: company, relationship: "SHARES_SECTOR", investment: {}, competition: { evidence_type: "shared operating sector", sector: record.get("sector") } })), 1),
                reason:
                    "An investor portfolio company and the target share an operating sector. This is a screening signal only; it does not establish that the companies compete directly."
            });
        }

        /* ======================================================
           ✅ NO CONFLICT
           ====================================================== */

        return res.json({
            hasConflict: false,
            conflictLevel: 0,
            score: 0,
            investor: investorName,
            targetCompany,
            graph: buildGraph(investorName, targetCompany, [], 0)
        });

    } catch (err) {
        console.error("COI check failed:", err);
        return res.status(500).json({
            error: "COI check failed"
        });
    } finally {
        await session.close();
    }
});

module.exports = router;
