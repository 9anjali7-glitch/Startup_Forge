const express = require('express');
const neo4j = require('neo4j-driver');
require('dotenv').config();
const uri = process.env.NEO4J_URI || 'bolt://host.docker.internal:7687';

const driver = neo4j.driver(
  uri,
  neo4j.auth.basic(
    process.env.NEO4J_USER || 'neo4j',
    process.env.NEO4J_PASSWORD || 'password'
  ),
  uri.startsWith('bolt') ? { encrypted: false } : {}
);

const router = express.Router();

/**
 * Get Inbox (Accepted Connections)
 * Returns all connections where status = 'ACCEPTED' and user is a participant.
 * Headers: x-user-id, x-user-role (for simulation)
 */
// GET Inbox (Accepted Connections from Neo4j)
router.get('/', async (req, res) => {
  const userId = req.headers['x-user-id'];
  if (!userId) return res.status(400).json({ error: 'Missing x-user-id header' });

  const session = driver.session();
  try {
    // Find all users connected to me
    // (me)-[:CONNECTED_TO]-(other)
    const query = `
      MATCH (me {id: $userId})-[:CONNECTED_TO]-(other)
      RETURN DISTINCT
        other.id as other_id, 
        other.name as other_name,
        other.founder as other_founder_name,
        other.firm_name as other_firm,
        coalesce(other.company, other.name) as other_company,
        labels(other) as labels
    `;

    const result = await session.run(query, { userId: String(userId) });

    // Map to the format expected by MessagesPage
    const connections = result.records.map(r => {
      const labels = r.get('labels');
      const isInvestor = labels.includes('Investor');
      const role = isInvestor ? 'INVESTOR' : 'FOUNDER';

      // Name logic similar to connections.routes.js
      // Investor: name=name, headline=firm_name
      // Company: founder=name, headline=name(company)
      const name = isInvestor ? r.get('other_name') : r.get('other_founder_name');
      const headline = isInvestor ? r.get('other_firm') : r.get('other_company');

      return {
        connection_id: `conn_${r.get('other_id')}`, // Synthetic ID
        other_user_id: r.get('other_id'),
        other_user_role: role,
        other_user_name: name,
        other_user_headline: headline,
        other_user_company: isInvestor ? null : r.get('other_company'),
        other_user_firm: isInvestor ? r.get('other_firm') : null,
        other_user_avatar: isInvestor
          ? 'https://cdn-icons-png.flaticon.com/512/147/147144.png'
          : 'https://cdn-icons-png.flaticon.com/512/149/149071.png'
      };
    });

    res.json({ connections });
  } catch (err) {
    console.error('Error fetching inbox from Neo4j:', err);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    session.close();
  }
});

module.exports = router;
