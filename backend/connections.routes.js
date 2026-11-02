const express = require('express');
const neo4j = require('neo4j-driver');
const router = express.Router();
require('dotenv').config();

// Initialize Driver (Same as server.js)
const uri = process.env.NEO4J_URI || 'bolt://host.docker.internal:7687';
const driver = neo4j.driver(
    uri,
    neo4j.auth.basic(process.env.NEO4J_USER || 'neo4j', process.env.NEO4J_PASSWORD || 'password'),
    uri.startsWith('bolt') ? { encrypted: false } : {}
);

// Directory cards use local IDs such as "investor-3", while graph records use
// numeric IDs or Neo4j element IDs. Normalize real graph IDs and resolve local
// directory cards by their displayed name/company instead of comparing unlike IDs.
function graphIdLookup(value) {
    const raw = String(value ?? '').trim();
    if (/^(investor|founder)-/i.test(raw)) return { aliases: [], elementId: '' };
    if (raw.startsWith('neo4j:')) return { aliases: [], elementId: raw.slice('neo4j:'.length) };
    const aliases = new Set(raw ? [raw] : []);
    if (/^[+-]?\d+(?:\.0+)?$/.test(raw)) {
        const numeric = Number(raw);
        if (Number.isSafeInteger(numeric)) {
            aliases.add(String(numeric));
            aliases.add(`${numeric}.0`);
        }
    }
    return { aliases: [...aliases], elementId: raw };
}

function sameGraphId(left, right) {
    const a = graphIdLookup(left);
    const b = graphIdLookup(right);
    return a.elementId === b.elementId || a.aliases.some(value => b.aliases.includes(value));
}

/**
 * Send Connection Request
 */
router.post('/request', async (req, res) => {
    const { sender_id, sender_role, receiver_id, receiver_role, message } = req.body;
    const senderName = String(req.auth?.name || req.body?.sender_name || '').trim();
    const receiverName = String(req.body?.receiver_name || '').trim();
    const senderCompany = String(req.auth?.organization || req.body?.sender_company || req.body?.sender_headline || '').trim();
    const receiverCompany = String(req.body?.receiver_company || req.body?.receiver_headline || '').trim();
    const normalizedSenderRole = String(req.auth?.role || sender_role || '').toLowerCase();
    const normalizedReceiverRole = String(receiver_role || '').toLowerCase();

    if (!['founder', 'investor'].includes(normalizedSenderRole) || !['founder', 'investor'].includes(normalizedReceiverRole)) {
        return res.status(400).json({ error: 'A valid founder or investor role is required.' });
    }
    if (!sender_id || !receiver_id || (!receiverName && !String(receiver_id).trim())) {
        return res.status(400).json({ error: 'Sender and receiver profiles are required.' });
    }

    if (String(sender_id) === String(receiver_id) && normalizedSenderRole === normalizedReceiverRole) {
        return res.status(400).json({ error: 'Cannot connect to yourself' });
    }
    if (senderName && receiverName && senderName.toLowerCase() === receiverName.toLowerCase() && normalizedSenderRole === normalizedReceiverRole) {
        return res.status(400).json({ error: 'Cannot connect to yourself' });
    }

    const session = driver.session();
    try {
        // Construct Labels
        const senderLabel = normalizedSenderRole === 'investor' ? 'Investor' : 'Company';
        const receiverLabel = normalizedReceiverRole === 'investor' ? 'Investor' : 'Company';
        const senderLookup = graphIdLookup(sender_id);
        const receiverLookup = graphIdLookup(receiver_id);
        const senderNameMatch = senderLabel === 'Investor'
            ? `toLower(trim(coalesce(s.name, ''))) = toLower($senderName)`
            : `(toLower(trim(coalesce(s.founder, ''))) = toLower($senderName) OR toLower(trim(coalesce(s.name, ''))) = toLower($senderName) OR toLower(trim(coalesce(s.name, ''))) = toLower($senderCompany))`;
        const receiverNameMatch = receiverLabel === 'Investor'
            ? `(toLower(trim(coalesce(r.name, ''))) = toLower($receiverName) OR toLower(trim(coalesce(r.firm_name, ''))) = toLower($receiverCompany))`
            : `(toLower(trim(coalesce(r.founder, ''))) = toLower($receiverName) OR toLower(trim(coalesce(r.name, ''))) = toLower($receiverName) OR toLower(trim(coalesce(r.name, ''))) = toLower($receiverCompany))`;

        // Check if ALREADY connected or pending
        // We use MERGE to ensure idempotency for 'PENDING'
        // But if 'ACCEPTED' exists, we should fail or return success?
        // Logic: MERGE relationship.

        const result = await session.run(`
            MATCH (s:${senderLabel}), (r:${receiverLabel})
            WHERE (toString(s.id) IN $senderIdAliases OR elementId(s) = $senderElementId OR ${senderNameMatch})
              AND (toString(r.id) IN $receiverIdAliases OR elementId(r) = $receiverElementId OR ${receiverNameMatch})
            WITH s, r
            ORDER BY elementId(s), elementId(r)
            LIMIT 1
            MERGE (s)-[rel:REQUESTED_CONNECTION]->(r)
            ON CREATE SET rel.status = 'PENDING', rel.message = $message, rel.created_at = datetime()
            ON MATCH SET rel.status = CASE WHEN rel.status = 'REJECTED' THEN 'PENDING' ELSE rel.status END,
                rel.message = $message
            RETURN rel.status as status
        `, {
            senderIdAliases: senderLookup.aliases,
            senderElementId: senderLookup.elementId,
            receiverIdAliases: receiverLookup.aliases,
            receiverElementId: receiverLookup.elementId,
            senderName,
            senderCompany,
            receiverName,
            receiverCompany,
            message: typeof message === 'string' ? message.slice(0, 1000) : ''
        });

        if (result.records.length === 0) {
            // Likely one of the nodes doesn't exist
            return res.status(404).json({ error: 'User not found in graph' });
        }

        const status = result.records[0].get('status');
        if (status === 'ACCEPTED') {
            return res.status(409).json({ error: 'Already connected' });
        }

        res.status(201).json({ status: 'PENDING' });

    } catch (err) {
        console.error("Neo4j Connect Error:", err);
        res.status(500).json({ error: 'Server error' });
    } finally {
        session.close();
    }
});

/** Reject a pending connection request without deleting its audit history. */
router.post('/reject/:id', async (req, res) => {
    const userId = req.headers['x-user-id'];
    const [senderId, receiverId] = req.params.id.split('_');
    if (!userId) return res.status(400).json({ error: 'Missing x-user-id header' });
    if (!senderId || !sameGraphId(receiverId, userId)) return res.status(400).json({ error: 'Invalid request id' });

    const session = driver.session();
    try {
        const senderLookup = graphIdLookup(senderId);
        const receiverLookup = graphIdLookup(userId);
        const result = await session.run(`
            MATCH (sender)-[r:REQUESTED_CONNECTION {status: 'PENDING'}]->(receiver)
            WHERE (toString(sender.id) IN $senderIdAliases OR elementId(sender) = $senderElementId)
              AND (toString(receiver.id) IN $receiverIdAliases OR elementId(receiver) = $receiverElementId)
            SET r.status = 'REJECTED', r.responded_at = datetime()
            RETURN r.status AS status
        `, {
            senderIdAliases: senderLookup.aliases,
            senderElementId: senderLookup.elementId,
            receiverIdAliases: receiverLookup.aliases,
            receiverElementId: receiverLookup.elementId
        });
        if (!result.records.length) return res.status(404).json({ error: 'Pending request not found' });
        res.json({ status: 'REJECTED' });
    } catch (err) {
        console.error('Reject request error:', err);
        res.status(500).json({ error: 'Server error' });
    } finally {
        await session.close();
    }
});

/**
 * Get Incoming Requests
 */
router.get('/notifications', async (req, res) => {
    const userId = req.headers['x-user-id'];
    if (!userId) return res.status(400).json({ error: 'Missing x-user-id header' });

    const session = driver.session();
    try {
        const userLookup = graphIdLookup(userId);
        const result = await session.run(`
            MATCH (me)-[r:REQUESTED_CONNECTION {status: 'ACCEPTED'}]->(receiver)
            WHERE toString(me.id) IN $userIdAliases OR elementId(me) = $userElementId
            WITH coalesce(toString(receiver.id), 'neo4j:' + elementId(receiver)) AS receiver_id,
                coalesce(receiver.name, receiver.founder, receiver.company) AS receiver_name,
                collect(r) AS requests
            WITH receiver_id, receiver_name, requests[0] AS r
            RETURN elementId(r) AS id, receiver_id, receiver_name, toString(r.responded_at) AS responded_at
            ORDER BY responded_at DESC
        `, { userIdAliases: userLookup.aliases, userElementId: userLookup.elementId });
        res.json(result.records.map(record => ({
            id: record.get('id'), receiver_id: record.get('receiver_id'),
            receiver_name: record.get('receiver_name'), responded_at: record.get('responded_at')
        })));
    } catch (err) {
        console.error('Notification fetch error:', err);
        res.status(500).json({ error: 'Server error' });
    } finally {
        await session.close();
    }
});

router.get('/requests/incoming', async (req, res) => {
    const userId = req.headers['x-user-id'];
    if (!userId) return res.status(400).json({ error: 'Missing x-user-id header' });

    const session = driver.session();
    try {
        const userLookup = graphIdLookup(userId);
        // Find requests directed AT this user
        // We don't know the user's role easily from header (unless passed), 
        // asking for both labels is safest or check if it exists.
        // Queries both possibilities:
        const query = `
            MATCH (sender)-[r:REQUESTED_CONNECTION {status: 'PENDING'}]->(me)
            WHERE toString(me.id) IN $userIdAliases OR elementId(me) = $userElementId
            WITH coalesce(toString(sender.id), 'neo4j:' + elementId(sender)) AS sender_id, labels(sender) AS sender_labels,
                sender.name AS sender_name, sender.firm_name AS sender_firm,
                coalesce(sender.company, sender.name) AS sender_company,
                sender.founder AS sender_founder, collect(r) AS requests
            WITH sender_id, sender_labels, sender_name, sender_firm, sender_company,
                sender_founder, requests[0] AS r
            RETURN 
                sender_id as sender_id,
                sender_labels,
                sender_name,
                sender_firm,
                sender_company,
                sender_founder,
                r.message as message,
                r.created_at as created_at
        `;

        const result = await session.run(query, { userIdAliases: userLookup.aliases, userElementId: userLookup.elementId });

        const mapped = result.records.map(rec => {
            const labels = rec.get('sender_labels');
            const isInvestor = labels.includes('Investor');
            const senderRole = isInvestor ? 'INVESTOR' : 'FOUNDER';
            const senderName = isInvestor ? rec.get('sender_name') : rec.get('sender_founder'); // Company node has 'founder' prop as name often? 
            // Wait, server.js says: Company node: founder=name, name=company_name
            // Let's re-verify server.js mapping. 
            // In server.js login: founder -> u.founder AS name, u.name AS headline
            // So 'sender_name' here should be the person's name.

            const name = isInvestor ? rec.get('sender_name') : rec.get('sender_founder');
            const headline = isInvestor ? rec.get('sender_firm') : rec.get('sender_company'); // Name of company is headline

            return {
                id: `${rec.get('sender_id')}_${userId}_${senderRole}`, // Synthetic ID for "Accept" endpoint
                sender_id: rec.get('sender_id'),
                sender_role: senderRole,
                sender_name: name,
                sender_headline: headline,
                sender_avatar: isInvestor
                    ? 'https://cdn-icons-png.flaticon.com/512/147/147144.png'
                    : 'https://cdn-icons-png.flaticon.com/512/149/149071.png',
                message: rec.get('message'),
                // created_at: rec.get('created_at').toString() // returns Neo4j object, simplfy:
                created_at: new Date().toISOString()
            };
        });

        res.json(mapped);
    } catch (err) {
        console.error("Neo4j Incoming Error:", err);
        res.status(500).json({ error: 'Server error' });
    } finally {
        session.close();
    }
});

/**
 * Get Outgoing Requests
 */
router.get('/requests/outgoing', async (req, res) => {
    const userId = req.headers['x-user-id'];
    const session = driver.session();
    try {
        if (!userId) return res.status(400).json({ error: 'Missing x-user-id header' });
        const userLookup = graphIdLookup(userId);
        const query = `
            MATCH (me)-[r:REQUESTED_CONNECTION {status: 'PENDING'}]->(receiver)
            WHERE toString(me.id) IN $userIdAliases OR elementId(me) = $userElementId
            RETURN DISTINCT coalesce(toString(receiver.id), 'neo4j:' + elementId(receiver)) as receiver_id, r.status as status
        `;
        const result = await session.run(query, { userIdAliases: userLookup.aliases, userElementId: userLookup.elementId });
        res.json(result.records.map(r => ({
            receiver_id: r.get('receiver_id'),
            status: r.get('status')
        })));
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    } finally {
        session.close();
    }
});

/**
 * Accept Request
 * Endpoint: POST /accept/:id
 * ID expected: "senderId_receiverId_senderRole" (Synthetic) OR just handle logic if we parse it.
 * Actually, checking the Frontend App.tsx, it calls handleAcceptRequest(requestId).
 * In NotificationsPage (implied), it renders the list using the 'id' we returned in GET /incoming.
 */
router.post('/accept/:id', async (req, res) => {
    const { id } = req.params; // Synthetic ID
    const userId = req.headers['x-user-id']; // Me (The Receiver)

    if (!userId) return res.status(400).json({ error: 'Missing x-user-id header' });

    // Parse the Synthetic ID: senderId_receiverId_senderRole
    // receiverId should match userId
    const parts = id.split('_');
    if (parts.length < 2) return res.status(400).json({ error: 'Invalid Request ID format' });

    const senderId = parts[0];
    const receiverIdFromId = parts[1]; // Should be me
    // Optional parts[2] is role

    if (!sameGraphId(receiverIdFromId, userId)) {
        return res.status(403).json({ error: 'Unauthorized: ID mismatch' });
    }

    const session = driver.session();
    try {
        const senderLookup = graphIdLookup(senderId);
        const receiverLookup = graphIdLookup(userId);
        // Transaction: 
        // 1. Mark REQUESTED_CONNECTION as ACCEPTED
        // 2. Create CONNECTED_TO relationships (bidirectional)

        // We match ANY label for sender since we have ID.
        // But matching by ID on generic nodes might be slow without label. 
        // We'll trust ID uniqueness or try both.

        const query = `
            MATCH (s)-[r:REQUESTED_CONNECTION]->(me)
            WHERE (toString(s.id) IN $senderIdAliases OR elementId(s) = $senderElementId)
              AND (toString(me.id) IN $userIdAliases OR elementId(me) = $userElementId)
            SET r.status = 'ACCEPTED', r.responded_at = datetime()
            MERGE (s)-[:CONNECTED_TO]->(me)
            MERGE (me)-[:CONNECTED_TO]->(s)
            RETURN r.status as status
        `;

        const result = await session.run(query, {
            senderIdAliases: senderLookup.aliases,
            senderElementId: senderLookup.elementId,
            userIdAliases: receiverLookup.aliases,
            userElementId: receiverLookup.elementId
        });

        if (result.records.length === 0) {
            return res.status(404).json({ error: 'Request not found' });
        }

        res.json({ status: 'ACCEPTED' });

    } catch (err) {
        console.error("Accept Error:", err);
        res.status(500).json({ error: 'Server error processing acceptance' });
    } finally {
        session.close();
    }
});

module.exports = router;
