// routes/admin.js
const express = require('express');
const router  = express.Router();
const pool    = require('../db');

function requireAuth(req, res, next) {
  const token = process.env.ADMIN_TOKEN;
  if (!token) return next(); // no token set = open (dev only)
  const provided = req.headers['x-admin-token'] || req.query.token;
  if (provided !== token) return res.status(401).json({ error: 'Unauthorised. Set x-admin-token header.' });
  next();
}

// GET /api/admin/contacts  — paginated list
router.get('/contacts', requireAuth, async (req, res) => {
  try {
    const page   = Math.max(1, parseInt(req.query.page  || '1'));
    const limit  = Math.min(50, parseInt(req.query.limit || '20'));
    const status = req.query.status;
    const offset = (page - 1) * limit;
    let where = '', params = [];
    if (status && ['new','read','archived'].includes(status)) { where = 'WHERE status=?'; params.push(status); }
    const [[{ total }]] = await pool.execute('SELECT COUNT(*) AS total FROM contacts ' + where, params);
    const [rows] = await pool.execute(
      'SELECT id, name, email, LEFT(message,120) AS preview, status, DATE_FORMAT(created_at,\'%d %b %Y %H:%i\') AS created FROM contacts ' + where + ' ORDER BY created_at DESC LIMIT ? OFFSET ?',
      [...params, limit, offset]
    );
    res.json({ data: rows, total, page, totalPages: Math.ceil(total / limit) });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/admin/contacts/:id  — full message, auto-marks read
router.get('/contacts/:id', requireAuth, async (req, res) => {
  try {
    const [rows] = await pool.execute(
      "SELECT id, name, email, message, status, DATE_FORMAT(created_at,'%d %b %Y %H:%i:%s') AS created FROM contacts WHERE id=?",
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Not found.' });
    if (rows[0].status === 'new') {
      await pool.execute("UPDATE contacts SET status='read' WHERE id=?", [req.params.id]);
      rows[0].status = 'read';
    }
    res.json(rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// PATCH /api/admin/contacts/:id  — update status
router.patch('/contacts/:id', requireAuth, async (req, res) => {
  const { status } = req.body;
  if (!['new','read','archived'].includes(status)) return res.status(400).json({ error: "status must be new, read, or archived" });
  try {
    const [r] = await pool.execute('UPDATE contacts SET status=? WHERE id=?', [status, req.params.id]);
    if (!r.affectedRows) return res.status(404).json({ error: 'Not found.' });
    res.json({ success: true, id: req.params.id, status });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// DELETE /api/admin/contacts/:id
router.delete('/contacts/:id', requireAuth, async (req, res) => {
  try {
    const [r] = await pool.execute('DELETE FROM contacts WHERE id=?', [req.params.id]);
    if (!r.affectedRows) return res.status(404).json({ error: 'Not found.' });
    res.json({ success: true, deleted: req.params.id });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/admin/contacts/export/csv
router.get('/contacts/export/csv', requireAuth, async (req, res) => {
  try {
    const [rows] = await pool.execute('SELECT id,name,email,message,status,created_at FROM contacts ORDER BY created_at DESC');
    const csv = 'id,name,email,message,status,created_at\n' +
      rows.map(r => [r.id, `"${r.name}"`, `"${r.email}"`, `"${(r.message||'').replace(/"/g,'""')}"`, r.status, r.created_at].join(',')).join('\n');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="contacts.csv"');
    res.send(csv);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
