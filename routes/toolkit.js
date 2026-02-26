// routes/toolkit.js
// Server-side proxy for all Threat Intelligence APIs.
// API keys live in .env only — never sent to the browser.
const express = require('express');
const router  = express.Router();
const https   = require('https');
const http    = require('http');

function fetchJSON(url, options = {}) {
  return new Promise((resolve, reject) => {
    const lib = url.startsWith('https') ? https : http;
    const req = lib.request(url, { method: options.method || 'GET', headers: options.headers || {} }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(data) }); }
        catch { resolve({ status: res.statusCode, body: { raw: data } }); }
      });
    });
    req.on('error', reject);
    if (options.body) req.write(JSON.stringify(options.body));
    req.end();
  });
}

// Simple per-IP rate limiter
const rl = new Map();
function checkRate(ip, key, max = 10) {
  const k = ip + ':' + key, now = Date.now();
  const e = rl.get(k) || { count: 0, reset: now + 60000 };
  if (now > e.reset) { e.count = 0; e.reset = now + 60000; }
  e.count++; rl.set(k, e);
  return e.count <= max;
}

// ── VirusTotal ─────────────────────────────────────────────────────
router.get('/vt/:type/:value', async (req, res) => {
  if (!checkRate(req.ip, 'vt')) return res.status(429).json({ error: 'Rate limit — wait 1 minute.' });
  const KEY = process.env.VT_API_KEY;
  if (!KEY) return res.status(503).json({ error: 'VT_API_KEY not set in .env' });
  const { type, value } = req.params;
  const map = {
    ip:     'https://www.virustotal.com/api/v3/ip_addresses/' + encodeURIComponent(value),
    domain: 'https://www.virustotal.com/api/v3/domains/'      + encodeURIComponent(value),
    hash:   'https://www.virustotal.com/api/v3/files/'        + value,
  };
  if (!map[type]) return res.status(400).json({ error: 'type must be ip, domain, or hash' });
  try {
    const { status, body } = await fetchJSON(map[type], { headers: { 'x-apikey': KEY } });
    res.status(status).json(body);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/vt/url', async (req, res) => {
  if (!checkRate(req.ip, 'vt')) return res.status(429).json({ error: 'Rate limit.' });
  const KEY = process.env.VT_API_KEY;
  if (!KEY) return res.status(503).json({ error: 'VT_API_KEY not set in .env' });
  const { url } = req.body;
  if (!url) return res.status(400).json({ error: 'url required' });
  try {
    const encoded = Buffer.from(url).toString('base64').replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
    const { status, body } = await fetchJSON('https://www.virustotal.com/api/v3/urls/' + encoded, { headers: { 'x-apikey': KEY } });
    res.status(status).json(body);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── GreyNoise ──────────────────────────────────────────────────────
router.get('/greynoise/:ip', async (req, res) => {
  if (!checkRate(req.ip, 'gn', 20)) return res.status(429).json({ error: 'Rate limit.' });
  try {
    const { status, body } = await fetchJSON('https://api.greynoise.io/v3/community/' + req.params.ip);
    res.status(status).json(body);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── URLScan.io ─────────────────────────────────────────────────────
router.post('/urlscan/submit', async (req, res) => {
  if (!checkRate(req.ip, 'urlscan', 5)) return res.status(429).json({ error: 'Rate limit.' });
  const KEY = process.env.URLSCAN_API_KEY;
  if (!KEY) return res.status(503).json({ error: 'URLSCAN_API_KEY not set in .env' });
  const { url } = req.body;
  if (!url) return res.status(400).json({ error: 'url required' });
  try {
    const { status, body } = await fetchJSON('https://urlscan.io/api/v1/scan/', {
      method: 'POST',
      headers: { 'API-Key': KEY, 'Content-Type': 'application/json' },
      body: { url, visibility: 'unlisted' },
    });
    res.status(status).json(body);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/urlscan/result/:uuid', async (req, res) => {
  try {
    const { status, body } = await fetchJSON('https://urlscan.io/api/v1/result/' + req.params.uuid + '/');
    res.status(status).json(body);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── crt.sh ─────────────────────────────────────────────────────────
router.get('/crt/:domain', async (req, res) => {
  if (!checkRate(req.ip, 'crt', 15)) return res.status(429).json({ error: 'Rate limit.' });
  try {
    const { status, body } = await fetchJSON('https://crt.sh/?q=%25.' + encodeURIComponent(req.params.domain) + '&output=json');
    res.status(status).json(body);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── CIRCL CVE ──────────────────────────────────────────────────────
router.get('/cve/latest', async (req, res) => {
  try {
    const { status, body } = await fetchJSON('https://cve.circl.lu/api/last/20');
    res.status(status).json(body);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/cve/:id', async (req, res) => {
  try {
    const { status, body } = await fetchJSON('https://cve.circl.lu/api/cve/' + encodeURIComponent(req.params.id.toUpperCase()));
    res.status(status).json(body);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
