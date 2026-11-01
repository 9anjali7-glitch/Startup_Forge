const express = require('express');

const router = express.Router();
const FEED_URL = 'https://www.sec.gov/cgi-bin/browse-edgar?action=getcurrent&type=D&owner=include&count=40&output=atom';
const CACHE_TTL_MS = 5 * 60 * 1000;
let cache = { entries: [], fetchedAt: null, expiresAt: 0, stale: true };

function decodeXml(value = '') {
  return value.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(parseInt(code, 16)))
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)));
}

function parseAtom(xml) {
  return [...xml.matchAll(/<entry\b[^>]*>([\s\S]*?)<\/entry>/gi)].map(([, entry]) => {
    const tag = (name) => decodeXml((entry.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)<\\/${name}>`, 'i')) || [])[1] || '').replace(/<[^>]+>/g, '').trim();
    const href = (entry.match(/<link\b[^>]*href=["']([^"']+)["'][^>]*\/?\s*>/i) || [])[1] || '';
    const title = tag('title');
    const updated = tag('updated') || tag('published');
    const summary = tag('summary');
    if (!title || !href) return null;
    return { title, url: decodeXml(href), filedAt: updated || null, summary: summary.slice(0, 600), form: 'D' };
  }).filter(Boolean);
}

router.get('/updates', async (_req, res) => {
  if (cache.entries.length && Date.now() < cache.expiresAt) {
    return res.json({ source: 'SEC EDGAR', sourceUrl: 'https://www.sec.gov/search-filings', fetchedAt: cache.fetchedAt, stale: false, entries: cache.entries });
  }
  try {
    const response = await fetch(FEED_URL, {
      headers: { 'User-Agent': process.env.SEC_USER_AGENT || 'StartupForge/1.0 (local public filing feed; configure SEC_USER_AGENT for contact)' , Accept: 'application/atom+xml, application/xml, text/xml' },
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) throw new Error(`SEC feed returned HTTP ${response.status}`);
    const xml = await response.text();
    const entries = parseAtom(xml).slice(0, 30);
    if (!entries.length) throw new Error('SEC feed contained no parseable entries');
    cache = { entries, fetchedAt: new Date().toISOString(), expiresAt: Date.now() + CACHE_TTL_MS, stale: false };
    return res.json({ source: 'SEC EDGAR', sourceUrl: 'https://www.sec.gov/search-filings', ...cache, stale: false });
  } catch (error) {
    console.error('SEC Form D feed unavailable:', error.message);
    return res.status(cache.entries.length ? 200 : 503).json({
      source: 'SEC EDGAR', sourceUrl: 'https://www.sec.gov/search-filings', fetchedAt: cache.fetchedAt,
      stale: cache.entries.length > 0, entries: cache.entries,
      error: cache.entries.length ? undefined : 'SEC filing feed is temporarily unavailable. Use the SEC source link to view current filings.',
    });
  }
});

module.exports = router;
