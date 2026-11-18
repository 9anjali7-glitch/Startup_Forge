const express = require('express');
const pool = require('./db');

const router = express.Router();
let schemaPromise;

function ensureSchema() {
  if (!schemaPromise) {
    schemaPromise = pool.query(`
      CREATE TABLE IF NOT EXISTS demo_investment_reports (
        connection_id TEXT NOT NULL,
        submitted_by TEXT NOT NULL,
        role TEXT NOT NULL CHECK (role IN ('founder', 'investor')),
        round TEXT,
        year TEXT,
        amount TEXT,
        approval_status TEXT NOT NULL DEFAULT 'PENDING_FOUNDER',
        reviewed_by TEXT,
        reviewed_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        PRIMARY KEY (connection_id, submitted_by)
      );
      CREATE INDEX IF NOT EXISTS demo_investment_reports_connection_idx
        ON demo_investment_reports (connection_id);
      ALTER TABLE demo_investment_reports ADD COLUMN IF NOT EXISTS approval_status TEXT NOT NULL DEFAULT 'PENDING_FOUNDER';
      ALTER TABLE demo_investment_reports ADD COLUMN IF NOT EXISTS reviewed_by TEXT;
      ALTER TABLE demo_investment_reports ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ;
    `).catch(error => {
      schemaPromise = null;
      throw error;
    });
  }
  return schemaPromise;
}

async function getAcceptedDemoConnection(connectionId, userId) {
  await ensureSchema();
  const result = await pool.query(`
    SELECT id, sender_id, sender_role, receiver_id, receiver_role
    FROM demo_connection_requests
    WHERE id = $1 AND status = 'ACCEPTED'
      AND (sender_id = $2 OR receiver_id = $2)
  `, [connectionId, userId]);
  return result.rows[0] || null;
}

function normalizeAmount(value) {
  return String(value ?? '').replace(/[^0-9.]/g, '').replace(/\.00$/, '');
}

router.get('/status/:connectionId', async (req, res) => {
  const userId = String(req.get('x-user-id') || '');
  const connectionId = String(req.params.connectionId || '');
  if (!userId || !connectionId) return res.status(400).json({ error: 'Missing connection or user.' });
  try {
    const connection = await getAcceptedDemoConnection(connectionId, userId);
    if (!connection) return res.status(404).json({ error: 'Accepted demo connection not found.' });
    const result = await pool.query(`SELECT round, year, amount, approval_status, submitted_by
      FROM demo_investment_reports WHERE connection_id = $1 AND role = 'investor' AND amount IS NOT NULL`, [connectionId]);
    const report = result.rows[0];
    if (!report) return res.json({ status: 'NONE' });
    return res.json({ status: report.approval_status, deal: { round: report.round, year: report.year, amount: report.amount }, investorId: report.submitted_by });
  } catch (error) {
    console.error('Demo investment status failed:', error.message);
    return res.status(503).json({ error: 'Investment reports are temporarily unavailable.' });
  }
});

router.post('/report', async (req, res) => {
  const userId = String(req.get('x-user-id') || '');
  const connectionId = String(req.body?.connectionId || '');
  if (!userId || !connectionId) return res.status(400).json({ error: 'Missing connection or user.' });
  try {
    const connection = await getAcceptedDemoConnection(connectionId, userId);
    if (!connection) return res.status(404).json({ error: 'Accepted demo connection not found.' });
  const role = connection.sender_id === userId ? connection.sender_role : connection.receiver_role;
  if (role !== 'investor') return res.status(403).json({ error: 'Only the investor can submit investment details.' });
    await pool.query(`
      INSERT INTO demo_investment_reports (connection_id, submitted_by, role)
      VALUES ($1, $2, $3)
      ON CONFLICT (connection_id, submitted_by) DO NOTHING
    `, [connectionId, userId, role]);
    return res.json({ success: true, status: 'PENDING' });
  } catch (error) {
    console.error('Demo investment report failed:', error.message);
    return res.status(503).json({ error: 'Investment reports are temporarily unavailable.' });
  }
});

router.post('/confirm', async (req, res) => {
  const userId = String(req.get('x-user-id') || '');
  const connectionId = String(req.body?.connectionId || '');
  const data = req.body?.data || {};
  const round = String(data.round || '').trim();
  const year = String(data.year || '').trim();
  const amount = String(data.amount || '').trim();
  if (!userId || !connectionId || !round || !/^\d{4}$/.test(year) || !normalizeAmount(amount)) {
    return res.status(400).json({ error: 'Enter a round, four-digit year, and investment amount.' });
  }
  try {
    const connection = await getAcceptedDemoConnection(connectionId, userId);
    if (!connection) return res.status(404).json({ error: 'Accepted demo connection not found.' });
    const role = connection.sender_id === userId ? connection.sender_role : connection.receiver_role;
    if (role !== 'investor') return res.status(403).json({ error: 'Only the investor can submit investment details.' });
    const prior = await pool.query('SELECT approval_status FROM demo_investment_reports WHERE connection_id = $1 AND submitted_by = $2', [connectionId, userId]);
    if (prior.rows[0]?.approval_status === 'ACCEPTED') return res.status(409).json({ error: 'The founder already accepted this record. It cannot be changed.' });
    await pool.query(`
    INSERT INTO demo_investment_reports (connection_id, submitted_by, role, round, year, amount, approval_status, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, 'PENDING_FOUNDER', NOW())
      ON CONFLICT (connection_id, submitted_by) DO UPDATE SET
        role = EXCLUDED.role, round = EXCLUDED.round, year = EXCLUDED.year,
        amount = EXCLUDED.amount, approval_status = 'PENDING_FOUNDER', reviewed_by = NULL, reviewed_at = NULL, updated_at = NOW()
    `, [connectionId, userId, role, round, year, amount]);
    return res.json({ status: 'PENDING_FOUNDER', success: true });
  } catch (error) {
    console.error('Demo investment confirmation failed:', error.message);
    return res.status(503).json({ error: 'Investment confirmation is temporarily unavailable.' });
  }
});

router.post('/respond', async (req, res) => {
  const userId = String(req.get('x-user-id') || '');
  const connectionId = String(req.body?.connectionId || '');
  const decision = String(req.body?.decision || '').toUpperCase();
  if (!userId || !connectionId || !['ACCEPTED', 'REJECTED'].includes(decision)) return res.status(400).json({ error: 'A valid decision is required.' });
  try {
    const connection = await getAcceptedDemoConnection(connectionId, userId);
    if (!connection) return res.status(404).json({ error: 'Accepted demo connection not found.' });
    const role = connection.sender_id === userId ? connection.sender_role : connection.receiver_role;
    if (role !== 'founder') return res.status(403).json({ error: 'Only the founder can accept or reject this report.' });
    const result = await pool.query(`UPDATE demo_investment_reports SET approval_status = $3, reviewed_by = $2, reviewed_at = NOW(), updated_at = NOW()
      WHERE connection_id = $1 AND role = 'investor' AND amount IS NOT NULL AND approval_status = 'PENDING_FOUNDER'
      RETURNING round, year, amount, approval_status`, [connectionId, userId, decision]);
    if (!result.rows[0]) return res.status(409).json({ error: 'There is no pending investor report to review.' });
    const deal = result.rows[0];
    return res.json({ status: deal.approval_status, deal: { round: deal.round, year: deal.year, amount: deal.amount } });
  } catch (error) {
    console.error('Demo investment decision failed:', error.message);
    return res.status(503).json({ error: 'Investment decision is temporarily unavailable.' });
  }
});

module.exports = router;

