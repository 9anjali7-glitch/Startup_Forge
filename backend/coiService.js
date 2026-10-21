const express = require('express');
const neo4j = require('neo4j-driver');

const router = express.Router();

const uri = process.env.NEO4J_URI || 'bolt://host.docker.internal:7687';
const driver = neo4j.driver(
    uri,
    neo4j.auth.basic(process.env.NEO4J_USER || "neo4j", process.env.NEO4J_PASSWORD || "password"),
    uri.startsWith('bolt') ? { encrypted: false } : {}
);

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
      MATCH (i)-[:INVESTED_IN]->(parent:Company)
            -[:HAS_SUBSIDIARY]->(sub:Company)
            -[:COMPETES_WITH]->(target)
      RETURN DISTINCT
        parent.name AS invested_parent,
        sub.name AS competing_subsidiary
    `;

        const level2Result = await session.run(level2Query, {
            investorName,
            targetCompany
        });

        if (level2Result.records.length > 0) {
            return res.json({
                hasConflict: true,
                conflictLevel: 2,
                conflictType: "indirect ownership + competition",
                confidence: "derived",
                score: 90,
                investor: investorName,
                targetCompany,
                conflicts: level2Result.records.map(r => ({
                    investedParent: r.get("invested_parent"),
                    competingSubsidiary: r.get("competing_subsidiary")
                })),
                reason:
                    "Investor has exposure to a parent entity whose subsidiary competes with the target company."
            });
        }

        /* ======================================================
           🟡 LEVEL 1 — SOFT COI (SECTOR OVERLAP)
           ====================================================== */

        const level1Query = `
      MATCH (i:Investor) WHERE toLower(i.name) = toLower($investorName)
      MATCH (target:Company) WHERE toLower(target.name) = toLower($targetCompany)
      MATCH (i)-[:INVESTED_IN]->(c1:Company)-[:OPERATES_IN]->(s:Domain)
      MATCH (target)-[:OPERATES_IN]->(s)
      WHERE c1.name <> target.name
      RETURN
        s.name AS sector,
        collect(DISTINCT c1.name) AS conflicting_companies
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
                conflictType: "direct portfolio sector overlap",
                confidence: "observed",
                score: 75,
                investor: investorName,
                targetCompany,
                sector: record.get("sector"),
                conflictingCompanies: record.get("conflicting_companies"),
                reason:
                    "Investor has prior investments in the same sector as the target company."
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
            targetCompany
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
