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
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        PRIMARY KEY (connection_id, submitted_by)
      );
      CREATE INDEX IF NOT EXISTS demo_investment_reports_connection_idx
        ON demo_investment_reports (connection_id);
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
    const result = await pool.query(`
      SELECT round, year, amount FROM demo_investment_reports
      WHERE connection_id = $1 AND amount IS NOT NULL
      ORDER BY created_at ASC
    `, [connectionId]);
    if (result.rows.length < 2) return res.json({ status: result.rows.length ? 'PENDING' : 'NONE' });
    const [first, second] = result.rows;
    const matched = normalizeAmount(first.amount) === normalizeAmount(second.amount)
      && String(first.year) === String(second.year) && first.round === second.round;
    return res.json(matched
      ? { status: 'MATCHED', deal: { round: first.round, year: first.year, amount: first.amount } }
      : { status: 'PENDING', mismatch: true });
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
    await pool.query(`
      INSERT INTO demo_investment_reports (connection_id, submitted_by, role, round, year, amount, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, NOW())
      ON CONFLICT (connection_id, submitted_by) DO UPDATE SET
        role = EXCLUDED.role, round = EXCLUDED.round, year = EXCLUDED.year,
        amount = EXCLUDED.amount, updated_at = NOW()
    `, [connectionId, userId, role, round, year, amount]);
    const result = await pool.query(`
      SELECT round, year, amount FROM demo_investment_reports
      WHERE connection_id = $1 AND amount IS NOT NULL
      ORDER BY created_at ASC
    `, [connectionId]);
    if (result.rows.length < 2) return res.json({ status: 'PENDING', mismatch: false });
    const [first, second] = result.rows;
    const matched = normalizeAmount(first.amount) === normalizeAmount(second.amount)
      && String(first.year) === String(second.year) && first.round === second.round;
    return res.json(matched
      ? { status: 'MATCHED', mismatch: false, deal: { round: first.round, year: first.year, amount: first.amount } }
      : { status: 'PENDING', mismatch: true });
  } catch (error) {
    console.error('Demo investment confirmation failed:', error.message);
    return res.status(503).json({ error: 'Investment confirmation is temporarily unavailable.' });
  }
});

module.exports = router;

