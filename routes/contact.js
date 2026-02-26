// routes/contact.js
const express    = require('express');
const router     = express.Router();
const nodemailer = require('nodemailer');
const pool       = require('../db');

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
function sanitise(str, max) { return String(str || '').trim().slice(0, max); }

// POST /api/contact
router.post('/', async (req, res) => {
  const name    = sanitise(req.body.name,    100);
  const email   = sanitise(req.body.email,   255);
  const message = sanitise(req.body.message, 2000);

  if (!name || !email || !message)
    return res.status(400).json({ message: 'Name, email, and message are required.' });
  if (!emailRegex.test(email))
    return res.status(400).json({ message: 'Invalid email address.' });

  let savedId = null;

  // 1. Save to MySQL
  try {
    const [result] = await pool.execute(
      'INSERT INTO contacts (name, email, message, status) VALUES (?, ?, ?, ?)',
      [name, email, message, 'new']
    );
    savedId = result.insertId;
    console.log(`[Contact] Saved id=${savedId} — ${name} <${email}>`);
  } catch (dbErr) {
    console.error('[Contact DB Error]', dbErr.message);
  }

  // 2. Send email notification (optional — only if SMTP is configured)
  if (process.env.SMTP_USER && process.env.SMTP_PASS) {
    try {
      const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
      });
      await transporter.sendMail({
        from:    `"Portfolio Contact" <${process.env.SMTP_USER}>`,
        to:       process.env.CONTACT_EMAIL || process.env.SMTP_USER,
        replyTo:  email,
        subject: `[Portfolio] New message from ${name}`,
        html: `<div style="font-family:monospace;max-width:600px;padding:24px;background:#0a1018;color:#e2eaf8;border-radius:8px;">
          <h2 style="color:#3d8ef0;margin:0 0 16px">New Portfolio Message</h2>
          <table style="width:100%;border-collapse:collapse;">
            <tr><td style="color:#5a7090;padding:6px 0;width:80px">ID</td><td style="color:#22d3ee">#${savedId || 'N/A'}</td></tr>
            <tr><td style="color:#5a7090;padding:6px 0">Name</td><td>${name}</td></tr>
            <tr><td style="color:#5a7090;padding:6px 0">Email</td><td><a href="mailto:${email}" style="color:#3d8ef0">${email}</a></td></tr>
          </table>
          <hr style="border-color:#1a2840;margin:16px 0"/>
          <div style="background:#0f1824;padding:16px;border-radius:4px;border-left:3px solid #3d8ef0;white-space:pre-wrap;line-height:1.7;">${message}</div>
          <p style="color:#5a7090;font-size:12px;margin-top:16px;">
            View in admin: <a href="${process.env.SITE_URL || 'http://localhost:3000'}/admin" style="color:#3d8ef0">Open Admin Dashboard</a>
          </p>
        </div>`,
      });
    } catch (mailErr) {
      console.error('[Contact Mail Error]', mailErr.message);
    }
  }

  return res.status(200).json({
    message: "Message received. I'll get back to you shortly.",
    ...(savedId && { id: savedId }),
  });
});

// GET /api/contact/stats — used by admin dashboard
router.get('/stats', async (req, res) => {
  try {
    const [[row]] = await pool.execute(`
      SELECT
        COUNT(*)                                   AS total,
        SUM(status = 'new')                        AS unread,
        SUM(status = 'read')                       AS read_count,
        SUM(status = 'archived')                   AS archived,
        COUNT(DISTINCT email)                      AS unique_senders,
        DATE_FORMAT(MAX(created_at), '%d %b %Y')   AS latest
      FROM contacts
    `);
    res.json(row);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
