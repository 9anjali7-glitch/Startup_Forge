const express = require('express');
const crypto = require('crypto');
const neo4j = require('neo4j-driver');
require('dotenv').config();

const router = express.Router();

// Initialize Driver (Same as server.js/inbox.routes.js)
const uri = process.env.NEO4J_URI || 'bolt://host.docker.internal:7687';
const driver = neo4j.driver(
  uri,
  neo4j.auth.basic(process.env.NEO4J_USER || 'neo4j', process.env.NEO4J_PASSWORD || 'password'),
  uri.startsWith('bolt') ? { encrypted: false } : {}
);

/**
 * Get/Create Chat Room Key by Target User ID
 * POST /chat
 * Headers: x-user-id
 * Body: { targetUserId }
 * 
 * New Logic (Neo4j):
 * 1. Check if users are connected in the graph.
 * 2. If yes, deterministically generate a room key based on their IDs.
 *    - sha256(sort(id1, id2).join('_'))
 * 3. Return key.
 * 
 * Note: We no longer store "chat_rooms" in Postgres. 
 * The room existence is purely virtual based on the connection relationship.
 */
router.post('/', async (req, res) => {
  const userId = req.headers['x-user-id'];
  const { targetUserId } = req.body;

  if (!userId || !targetUserId) {
    return res.status(400).json({ error: 'Missing x-user-id or targetUserId' });
  }

  const session = driver.session();
  try {
    // 1. Verify Connection exists in Neo4j
    const query = `
      MATCH (u1 {id: $userId})-[r:CONNECTED_TO]-(u2 {id: $targetUserId})
      RETURN count(r) > 0 as isConnected
    `;

    const result = await session.run(query, {
      userId: String(userId),
      targetUserId: String(targetUserId)
    });

    const isConnected = result.records[0].get('isConnected');

    if (!isConnected) {
      return res.status(403).json({ error: 'Users are not connected' });
    }

    // 2. Generate Deterministic Room Key
    // Sort IDs to ensure same key regardless of who initiates
    const ids = [String(userId), String(targetUserId)].sort();
    const roomKey = crypto
      .createHash('sha256')
      .update(`chat:${ids[0]}_${ids[1]}`)
      .digest('hex');

    // Return room key
    res.json({
      roomKey,
      connectionId: `conn_${ids[0]}_${ids[1]}`
    });

  } catch (err) {
    console.error("Chat Init Error (Neo4j):", err);
    res.status(500).json({ error: 'Server error' });
  } finally {
    session.close();
  }
});

module.exports = router;
