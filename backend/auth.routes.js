const express = require('express');
const { randomBytes, randomUUID, scrypt: scryptCallback, timingSafeEqual, createHash } = require('crypto');
const { promisify } = require('util');
const neo4j = require('neo4j-driver');
const pool = require('./db');

const scrypt = promisify(scryptCallback);
const router = express.Router();
const uri = process.env.NEO4J_URI || 'bolt://host.docker.internal:7687';
const graph = neo4j.driver(uri, neo4j.auth.basic(
  process.env.NEO4J_USER || 'neo4j', process.env.NEO4J_PASSWORD || 'password'
), uri.startsWith('bolt') ? { encrypted: false } : {});

let schemaPromise;
function ensureAuthSchema() {
  if (!schemaPromise) {
    schemaPromise = pool.query(`
      CREATE TABLE IF NOT EXISTS auth_accounts (
        id UUID PRIMARY KEY,
        user_id TEXT NOT NULL UNIQUE,
        email TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        name TEXT NOT NULL,
        role TEXT NOT NULL CHECK (role IN ('founder', 'investor')),
        organization TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS auth_sessions (
        id UUID PRIMARY KEY,
        account_id UUID NOT NULL REFERENCES auth_accounts(id) ON DELETE CASCADE,
        token_hash CHAR(64) NOT NULL UNIQUE,
        expires_at TIMESTAMPTZ NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS auth_sessions_expiry_idx ON auth_sessions(expires_at);
    `).catch(error => {
      schemaPromise = null;
      throw error;
    });
  }
  return schemaPromise;
}

const tokenDigest = token => createHash('sha256').update(token).digest('hex');
async function makePasswordHash(password) {
  const salt = randomBytes(16);
  const key = await scrypt(password, salt, 64, { N: 16384, r: 8, p: 1 });
  return `scrypt$${salt.toString('base64url')}$${key.toString('base64url')}`;
}
async function verifyPassword(password, saved) {
  const [algorithm, saltText, keyText] = String(saved || '').split('$');
  if (algorithm !== 'scrypt' || !saltText || !keyText) return false;
  const expected = Buffer.from(keyText, 'base64url');
  const actual = await scrypt(password, Buffer.from(saltText, 'base64url'), expected.length, { N: 16384, r: 8, p: 1 });
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

async function createSession(account) {
  const token = randomBytes(32).toString('base64url');
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  await pool.query('DELETE FROM auth_sessions WHERE expires_at <= NOW()');
  await pool.query(
    'INSERT INTO auth_sessions (id, account_id, token_hash, expires_at) VALUES ($1, $2, $3, $4)',
    [randomUUID(), account.id, tokenDigest(token), expiresAt]
  );
  return { token, expiresAt };
}

function publicAccount(account) {
  return {
    id: String(account.user_id),
    name: account.name,
    role: account.role,
    headline: account.role === 'founder' ? `Founder at ${account.organization}` : `Investor at ${account.organization}`,
    organization: account.organization,
    expiresAt: account.expiresAt || account.expires_at,
  };
}

async function authenticateToken(token) {
  if (!token || token.length > 200) return null;
  await ensureAuthSchema();
  const result = await pool.query(`
    SELECT a.id, a.user_id, a.name, a.role, a.organization, s.expires_at
    FROM auth_sessions s JOIN auth_accounts a ON a.id = s.account_id
    WHERE s.token_hash = $1 AND s.expires_at > NOW()
  `, [tokenDigest(token)]);
  return result.rows[0] || null;
}

const authAttempts = new Map();
function limitAuthAttempts(req, res, next) {
  const now = Date.now();
  const key = req.ip || req.socket.remoteAddress || 'unknown';
  const prior = authAttempts.get(key);
  if (!prior || now - prior.start > 15 * 60 * 1000) {
    authAttempts.set(key, { start: now, count: 1 });
    return next();
  }
  if (prior.count >= 30) return res.status(429).json({ error: 'Too many sign-in attempts. Please wait 15 minutes and try again.' });
  prior.count += 1;
  next();
}

router.post('/register', limitAuthAttempts, async (req, res) => {
  const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
  const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  const password = typeof req.body?.password === 'string' ? req.body.password : '';
  const role = typeof req.body?.role === 'string' ? req.body.role.trim().toLowerCase() : '';
  const organization = typeof req.body?.organization === 'string' ? req.body.organization.trim() : '';
  if (name.length < 2 || name.length > 120 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
    return res.status(400).json({ error: 'Enter your name and a valid email address.' });
  }
  if (password.length < 12 || password.length > 128) return res.status(400).json({ error: 'Use a password between 12 and 128 characters.' });
  if (!['founder', 'investor'].includes(role) || organization.length < 2 || organization.length > 160) {
    return res.status(400).json({ error: 'Choose Founder or Investor and enter your company or fund.' });
  }

  const id = randomUUID();
  let account;
  let graphCreated = false;
  try {
    await ensureAuthSchema();
    const passwordHash = await makePasswordHash(password);
    const inserted = await pool.query(`
      INSERT INTO auth_accounts (id, user_id, email, password_hash, name, role, organization)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING id, user_id, name, role, organization
    `, [id, id, email, passwordHash, name, role, organization]);
    account = inserted.rows[0];

    const session = graph.session();
    try {
      if (role === 'investor') {
        await session.run(`
          CREATE (u:Investor {id: $id, name: $name, firm_name: $organization,
            short_bio: '', location: 'Not provided', domain: '', primary_domain: '',
            is_active_investing: true, profile_source: 'account registration',
            verification_status: 'unverified'})
        `, { id, name, organization });
      } else {
        await session.run(`
          CREATE (u:Company {id: $id, name: $organization, founder: $name,
            description: '', location: 'Not provided', domain: '',
            profile_source: 'account registration', verification_status: 'unverified'})
        `, { id, name, organization });
      }
      graphCreated = true;
    } finally {
      await session.close();
    }

    const { token, expiresAt } = await createSession(account);
    return res.status(201).json({ success: true, token, expiresAt, user: publicAccount({ ...account, expiresAt }) });
  } catch (error) {
    if (graphCreated) {
      const cleanup = graph.session();
      try { await cleanup.run('MATCH (u) WHERE u.id = $id DETACH DELETE u', { id }); }
      catch (cleanupError) { console.error('Could not remove an incomplete account profile:', cleanupError.message); }
      finally { await cleanup.close(); }
    }
    if (account) {
      await pool.query('DELETE FROM auth_accounts WHERE id = $1', [account.id]).catch(() => {});
    }
    if (error.code === '23505') return res.status(409).json({ error: 'An account with that email already exists.' });
    console.error('Account registration failed:', error.message);
    return res.status(503).json({ error: 'Account setup is temporarily unavailable. Please retry shortly.' });
  }
});

router.post('/login', limitAuthAttempts, async (req, res) => {
  const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  const password = typeof req.body?.password === 'string' ? req.body.password : '';
  if (email.length > 254 || password.length > 128) return res.status(400).json({ error: 'Email or password is invalid.' });
  try {
    await ensureAuthSchema();
    const result = await pool.query(
      'SELECT id, user_id, email, password_hash, name, role, organization FROM auth_accounts WHERE email = $1',
      [email]
    );
    const account = result.rows[0];
    if (!account || !(await verifyPassword(password, account.password_hash))) {
      return res.status(401).json({ error: 'Email or password is incorrect.' });
    }
    const { token, expiresAt } = await createSession(account);
    return res.json({ success: true, token, expiresAt, user: publicAccount({ ...account, expiresAt }) });
  } catch (error) {
    console.error('Sign-in failed:', error.message);
    return res.status(503).json({ error: 'Sign-in is temporarily unavailable. Please retry shortly.' });
  }
});

router.post('/logout', async (req, res) => {
  const token = req.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (token) {
    try {
      await ensureAuthSchema();
      await pool.query('DELETE FROM auth_sessions WHERE token_hash = $1', [tokenDigest(token)]);
    } catch (error) {
      console.error('Session logout failed:', error.message);
      return res.status(503).json({ error: 'The session could not be revoked on the server. Close this tab and sign in again later.' });
    }
  }
  res.json({ success: true });
});

router.get('/me', async (req, res) => {
  const account = await authenticateToken(req.get('authorization')?.replace(/^Bearer\s+/i, ''));
  if (!account) return res.status(401).json({ error: 'Sign in again to continue.' });
  res.json({ success: true, user: publicAccount(account) });
});

module.exports = { router, authenticateToken };
