const express = require('express');
const normalizeAmount = value => String(value ?? '').replace(/[^0-9.]/g, '').replace(/\.00$/, '');
const router = express.Router();
const neo4j = require('neo4j-driver');
require('dotenv').config();

// Initialize Driver
const uri = process.env.NEO4J_URI || 'bolt://host.docker.internal:7687';
const driver = neo4j.driver(
    uri,
    neo4j.auth.basic(process.env.NEO4J_USER || 'neo4j', process.env.NEO4J_PASSWORD || 'password'),
    uri.startsWith('bolt') ? { encrypted: false } : {}
);

/**
 * GET Status
 * Checks for InvestmentReport nodes linked to this connectionId
 */
router.get('/status/:connectionId', async (req, res) => {
    const { connectionId } = req.params;
    if (!connectionId) return res.status(400).json({ error: "Missing connectionId" });

    const session = driver.session();
    try {
        // Find reports linked to this connection
        const result = await session.run(`
            MATCH (r:InvestmentReport {connectionId: $connectionId})
            RETURN r ORDER BY r.updated_at DESC
        `, { connectionId });

        const report = result.records.map(rec => rec.get('r').properties).find(r => r.role === 'investor' && r.amount != null);
        return report
            ? res.json({ status: report.approvalStatus || 'PENDING_FOUNDER', deal: { round: report.round, year: report.year, amount: report.amount }, investorId: report.submittedBy })
            : res.json({ status: 'NONE' });

    } catch (e) {
        console.error("Inv Status Error:", e);
        res.status(500).json({ error: "Server Error" });
    } finally {
        session.close();
    }
});

/**
 * POST Report (Intent)
 * Creates an InvestmentReport node with status='INTENT' or similar (just missing data)
 */
router.post('/report', async (req, res) => {
    const { connectionId } = req.body;
    const userId = req.headers['x-user-id']; // Frontend must send this

    if (!connectionId || !userId) return res.status(400).json({ error: "Missing info" });

    const session = driver.session();
    try {
        // MERGE report node for this user + connection to avoid dupes
        await session.run(`
            MERGE (r:InvestmentReport {connectionId: $connectionId, submittedBy: $userId})
            ON CREATE SET r.created_at = datetime(), r.role = 'unknown' // Role will be updated on confirm
        `, { connectionId, userId });

        res.json({ success: true });
    } catch (e) {
        console.error("Inv Report Error:", e);
        res.status(500).json({ error: "Server Error" });
    } finally {
        session.close();
    }
});

/**
 * POST Confirm (Submit Data)
 * Updates the InvestmentReport node with actual details
 */
router.post('/confirm', async (req, res) => {
    const { connectionId, role, data } = req.body;
    const userId = req.headers['x-user-id'];

    if (!connectionId || !data) return res.status(400).json({ error: "Missing data" });

    // Fallback if userId missing (though it shouldn't be with our fix)
    const submittedBy = userId || "unknown";

    const session = driver.session();
    try {
        if (req.auth?.role !== 'investor') return res.status(403).json({ error: 'Only the investor can submit investment details.' });
        // Update the report
        await session.run(`
            MERGE (r:InvestmentReport {connectionId: $connectionId, submittedBy: $submittedBy})
            SET r.role = $role,
                r.round = $round,
                r.year = $year,
                r.amount = $amount,
                r.approvalStatus = 'PENDING_FOUNDER',
                r.updated_at = datetime()
        `, {
            connectionId,
            submittedBy,
            role,
            round: data.round,
            year: String(data.year),
            amount: String(data.amount)
        });

        res.json({ status: 'PENDING_FOUNDER' });

    } catch (e) {
        console.error("Inv Confirm Error:", e);
        res.status(500).json({ error: "Server Error" });
    } finally {
        session.close();
    }
});

router.post('/respond', async (req, res) => {
    const { connectionId, decision } = req.body || {};
    const userId = req.headers['x-user-id'];
    const status = String(decision || '').toUpperCase();
    if (!connectionId || !userId || !['ACCEPTED', 'REJECTED'].includes(status)) return res.status(400).json({ error: 'A valid founder decision is required.' });
    if (req.auth?.role !== 'founder') return res.status(403).json({ error: 'Only the founder can accept or reject this report.' });
    const session = driver.session();
    try {
        const result = await session.run(`
            MATCH (r:InvestmentReport {connectionId: $connectionId, role: 'investor'})
            WHERE r.amount IS NOT NULL AND coalesce(r.approvalStatus, 'PENDING_FOUNDER') = 'PENDING_FOUNDER'
            SET r.approvalStatus = $status, r.reviewedBy = $userId, r.reviewedAt = datetime(), r.updated_at = datetime()
            RETURN r.round AS round, r.year AS year, r.amount AS amount, r.approvalStatus AS status
        `, { connectionId, status, userId });
        if (!result.records.length) return res.status(409).json({ error: 'There is no pending investor report to review.' });
        const row = result.records[0];
        res.json({ status: row.get('status'), deal: { round: row.get('round'), year: row.get('year'), amount: row.get('amount') } });
    } catch (error) {
        console.error('Investment decision failed:', error);
        res.status(500).json({ error: 'Could not record the founder decision.' });
    } finally { await session.close(); }
});

/**
 * GET Updates
 * Returns confirmed investments from the network
 */
router.get('/updates', async (req, res) => {
    const userId = req.headers['x-user-id'];
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const session = driver.session();
    try {
        // Find investments where:
        // 1. A report exists by a Founder
        // 2. The report is MATCHED (exists another report with same values by investor)
        // 3. The founder is connected to the requester via :CONNECTED_TO
        const query = `
            MATCH (me {id: $userId})-[:CONNECTED_TO]-(f:Company)
            MATCH (r1:InvestmentReport {submittedBy: f.id, role: 'founder'})
            MATCH (r2:InvestmentReport {connectionId: r1.connectionId, role: 'investor'})
            WHERE r1.amount = r2.amount AND r1.year = r2.year AND r1.round = r2.round
            RETURN DISTINCT 
                f.id as founder_id,
                f.name as company,
                f.valuation as valuation,
                r1.round as round,
                r1.amount as amount,
                r1.year as year,
                toString(r1.created_at) as time
            ORDER BY time DESC
            LIMIT 10
        `;

        const result = await session.run(query, { userId });
        const updates = result.records.map(rec => ({
            founder_id: rec.get('founder_id'),
            company: rec.get('company'),
            valuation: rec.get('valuation'),
            round: rec.get('round'),
            amount: rec.get('amount'),
            year: rec.get('year'),
            time: rec.get('time')
        }));

        res.json(updates);

    } catch (e) {
        console.error("Inv Updates Error:", e);
        res.status(500).json({ error: "Server Error" });
    } finally {
        session.close();
    }
});

module.exports = router;

