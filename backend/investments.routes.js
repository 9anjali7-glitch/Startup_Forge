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
    const userId = req.auth?.id || req.headers['x-user-id'];
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const session = driver.session();
    try {
        // An investor submits one report and the founder accepts it in the inbox.
        // The accepted report is the agreed record; a second founder report is not created.
        const query = `
            MATCH (me {id: $userId})-[:CONNECTED_TO]-(other)
            WITH me, other,
              CASE WHEN toString(me.id) < toString(other.id)
                THEN 'conn_' + toString(me.id) + '_' + toString(other.id)
                ELSE 'conn_' + toString(other.id) + '_' + toString(me.id)
              END AS connectionId
            MATCH (r:InvestmentReport {connectionId: connectionId, role: 'investor', approvalStatus: 'ACCEPTED'})
            WHERE r.amount IS NOT NULL
              AND toString(r.submittedBy) IN [toString(me.id), toString(other.id)]
            WITH DISTINCT r,
              CASE WHEN 'Company' IN labels(me) THEN me ELSE other END AS founderNode,
              CASE WHEN 'Investor' IN labels(me) THEN me ELSE other END AS investorNode
            RETURN founderNode.id AS founder_id,
                coalesce(founderNode.name, founderNode.company, founderNode.founder) AS company,
                founderNode.founder AS founder,
                investorNode.name AS investor,
                r.round AS round,
                r.amount AS amount,
                r.year AS year,
                toString(r.updated_at) AS time
            ORDER BY time DESC
        `;

        const result = await session.run(query, { userId });
        const updates = result.records.map(rec => ({
            founder_id: rec.get('founder_id'),
            company: rec.get('company'),
            founder: rec.get('founder'),
            investor: rec.get('investor'),
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

