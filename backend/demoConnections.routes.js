const express = require('express');
const pool = require('./db');

const router = express.Router();
let schemaPromise;
const requestAttempts = new Map();

function ensureSchema() {
  if (!schemaPromise) {
    schemaPromise = pool.query(`
      CREATE TABLE IF NOT EXISTS demo_connection_requests (
        id TEXT PRIMARY KEY,
        sender_id TEXT NOT NULL,
        sender_role TEXT NOT NULL CHECK (sender_role IN ('founder', 'investor')),
        sender_name TEXT NOT NULL,
        sender_headline TEXT NOT NULL DEFAULT '',
        sender_avatar TEXT NOT NULL DEFAULT '',
        receiver_id TEXT NOT NULL,
        receiver_role TEXT NOT NULL CHECK (receiver_role IN ('founder', 'investor')),
        receiver_name TEXT NOT NULL,
        receiver_headline TEXT NOT NULL DEFAULT '',
        receiver_avatar TEXT NOT NULL DEFAULT '',
        message TEXT NOT NULL DEFAULT '',
        status TEXT NOT NULL CHECK (status IN ('PENDING', 'ACCEPTED', 'REJECTED', 'CANCELLED')),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        responded_at TIMESTAMPTZ
      );
      CREATE INDEX IF NOT EXISTS demo_connection_incoming_idx
        ON demo_connection_requests (receiver_id, status, created_at DESC);
      CREATE INDEX IF NOT EXISTS demo_connection_outgoing_idx
        ON demo_connection_requests (sender_id, status, created_at DESC);
    `).catch(error => {
      schemaPromise = null;
      throw error;
    });
  }
  return schemaPromise;
}

function canonicalDemoId(role, name) {
  const normalizedRole = String(role || '').trim().toLowerCase();
  const normalizedName = String(name || '').trim();
  if (!['founder', 'investor'].includes(normalizedRole) || normalizedName.length < 2 || normalizedName.length > 120) return null;
  return `demo-${normalizedRole}-${normalizedName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}`;
}

function rateLimit(req, res, next) {
  const now = Date.now();
  const key = req.ip || req.socket.remoteAddress || 'unknown';
  const previous = requestAttempts.get(key);
  if (!previous || now - previous.startedAt > 60_000) {
    requestAttempts.set(key, { startedAt: now, count: 1 });
    return next();
  }
  if (previous.count >= 40) return res.status(429).json({ error: 'Too many demo connection actions. Please try again shortly.' });
  previous.count += 1;
  next();
}

function mapRequest(row) {
  return {
    id: row.id,
    senderId: row.sender_id,
    senderRole: row.sender_role,
    senderName: row.sender_name,
    senderHeadline: row.sender_headline,
    senderAvatar: row.sender_avatar,
    receiverId: row.receiver_id,
    receiverRole: row.receiver_role,
    receiverName: row.receiver_name,
    receiverAvatar: row.receiver_avatar,
    receiverHeadline: row.receiver_headline,
    message: row.message,
    status: row.status,
    createdAt: row.created_at,
    respondedAt: row.responded_at,
  };
}

router.use(rateLimit);

router.post('/request', async (req, res) => {
  const body = req.body || {};
  const senderId = canonicalDemoId(body.senderRole, body.senderName);
  const receiverId = canonicalDemoId(body.receiverRole, body.receiverName);
  if (!senderId || senderId !== String(body.senderId || '') || !receiverId || receiverId !== String(body.receiverId || '')) {
    return res.status(400).json({ error: 'A valid demo sender and receiver profile are required.' });
  }
  if (senderId === receiverId) return res.status(400).json({ error: 'Cannot connect to yourself.' });

  const id = `${senderId}__${receiverId}`;
  try {
    await ensureSchema();
    const existing = await pool.query('SELECT * FROM demo_connection_requests WHERE id = $1', [id]);
    if (existing.rows[0]?.status === 'ACCEPTED') return res.status(409).json({ error: 'Already connected.' });
    if (existing.rows[0]?.status === 'PENDING') return res.json(mapRequest(existing.rows[0]));

    const result = await pool.query(`
      INSERT INTO demo_connection_requests (
        id, sender_id, sender_role, sender_name, sender_headline, sender_avatar,
        receiver_id, receiver_role, receiver_name, receiver_headline, receiver_avatar,
        message, status, created_at, responded_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'PENDING', NOW(), NULL)
      ON CONFLICT (id) DO UPDATE SET
        sender_role = EXCLUDED.sender_role, sender_name = EXCLUDED.sender_name,
        sender_headline = EXCLUDED.sender_headline, sender_avatar = EXCLUDED.sender_avatar,
        receiver_role = EXCLUDED.receiver_role, receiver_name = EXCLUDED.receiver_name,
        receiver_headline = EXCLUDED.receiver_headline, receiver_avatar = EXCLUDED.receiver_avatar,
        message = EXCLUDED.message, status = 'PENDING', created_at = NOW(), responded_at = NULL
      RETURNING *
    `, [
      id, senderId, String(body.senderRole).toLowerCase(), String(body.senderName).trim().slice(0, 120),
      String(body.senderHeadline || '').slice(0, 240), String(body.senderAvatar || '').slice(0, 1000),
      receiverId, String(body.receiverRole).toLowerCase(), String(body.receiverName).trim().slice(0, 120),
      String(body.receiverHeadline || '').slice(0, 240), String(body.receiverAvatar || '').slice(0, 1000),
      String(body.message || '').slice(0, 1000),
    ]);
    res.status(201).json(mapRequest(result.rows[0]));
  } catch (error) {
    console.error('Demo connection request failed:', error.message);
    res.status(503).json({ error: 'Connection requests are temporarily unavailable.' });
  }
});

router.get('/:userId/incoming', async (req, res) => {
  try {
    await ensureSchema();
    const result = await pool.query(`
      SELECT * FROM demo_connection_requests
      WHERE receiver_id = $1 AND status IN ('PENDING', 'ACCEPTED')
      ORDER BY created_at DESC
    `, [String(req.params.userId).slice(0, 160)]);
    res.json(result.rows.map(mapRequest));
  } catch (error) {
    console.error('Demo incoming requests failed:', error.message);
    res.status(503).json({ error: 'Connection requests are temporarily unavailable.' });
  }
});

router.get('/:userId/outgoing', async (req, res) => {
  try {
    await ensureSchema();
    const result = await pool.query(`
      SELECT * FROM demo_connection_requests
      WHERE sender_id = $1 AND status IN ('PENDING', 'ACCEPTED')
      ORDER BY created_at DESC
    `, [String(req.params.userId).slice(0, 160)]);
    res.json(result.rows.map(mapRequest));
  } catch (error) {
    console.error('Demo outgoing requests failed:', error.message);
    res.status(503).json({ error: 'Connection requests are temporarily unavailable.' });
  }
});

router.post('/:id/respond', async (req, res) => {
  const id = String(req.params.id || '').slice(0, 320);
  const userId = String(req.body?.userId || '').slice(0, 160);
  const status = String(req.body?.status || '').toUpperCase();
  if (!['ACCEPTED', 'REJECTED', 'CANCELLED'].includes(status)) {
    return res.status(400).json({ error: 'A valid response status is required.' });
  }
  try {
    await ensureSchema();
    const ownerColumn = status === 'CANCELLED' ? 'sender_id' : 'receiver_id';
    const updated = await pool.query(`
      UPDATE demo_connection_requests
      SET status = $3, responded_at = NOW()
      WHERE id = $1 AND ${ownerColumn} = $2 AND status = 'PENDING'
      RETURNING *
    `, [id, userId, status]);
    if (updated.rows[0]) return res.json(mapRequest(updated.rows[0]));
    const existing = await pool.query('SELECT * FROM demo_connection_requests WHERE id = $1', [id]);
    if (!existing.rows[0]) return res.status(404).json({ error: 'Connection request not found.' });
    if (existing.rows[0][ownerColumn] !== userId) return res.status(403).json({ error: 'This demo profile cannot respond to the request.' });
    if (existing.rows[0].status === status) return res.json(mapRequest(existing.rows[0]));
    return res.status(409).json({ error: 'This connection request has already been answered.' });
  } catch (error) {
    console.error('Demo connection response failed:', error.message);
    res.status(503).json({ error: 'Connection requests are temporarily unavailable.' });
  }
});

module.exports = router;

