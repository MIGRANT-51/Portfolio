// server.js
require('dotenv').config();
const express       = require('express');
const cors          = require('cors');
const { initDB }    = require('./db');

// Routes — contact moved to routes/ subfolder
const contactRoutes = require('./routes/contact');
const toolkitRoutes = require('./routes/toolkit');  // NEW: threat intel API proxy
const adminRoutes   = require('./routes/admin');    // NEW: contact inbox CRUD

const app  = express();
const PORT = process.env.PORT || 3000;

// Enable CORS
app.use(cors());

// Parse JSON bodies (built-in middleware)
app.use(express.json());

// Serve static files (e.g., your portfolio HTML/CSS/JS) from the "public" folder
app.use(express.static('public'));

// Mount the contact routes under /api/contact
app.use('/api/contact', contactRoutes);

// Threat Intelligence Toolkit proxy — API keys stay server-side, never in browser
app.use('/api/toolkit', toolkitRoutes);

// Admin inbox — protected by ADMIN_TOKEN in .env
app.use('/api/admin', adminRoutes);

// Admin dashboard page
app.get('/admin', (req, res) => {
  res.sendFile(__dirname + '/public/admin.html');
});

// Health check — shows which keys are loaded
app.get('/api/health', (req, res) => {
  res.json({
    status:    'ok',
    timestamp: new Date().toISOString(),
    keys: {
      virustotal: !!process.env.VT_API_KEY,
      urlscan:    !!process.env.URLSCAN_API_KEY,
    },
    db: !!process.env.DB_HOST,
  });
});

// Global error handling middleware
app.use((err, req, res, next) => {
  console.error('Unexpected error:', err);
  res.status(500).json({ message: 'An unexpected error occurred.' });
});

// Start — connect to DB first, then listen
async function start() {
  console.log('\n🛡  NK Portfolio Server');
  await initDB();
  app.listen(PORT, () => {
    console.log(`   Running  →  http://localhost:${PORT}`);
    console.log(`   Admin    →  http://localhost:${PORT}/admin`);
    console.log(`   Health   →  http://localhost:${PORT}/api/health`);
    console.log(`   VT key:     ${process.env.VT_API_KEY      ? '✓ loaded' : '✗ missing'}`);
    console.log(`   URLScan:    ${process.env.URLSCAN_API_KEY  ? '✓ loaded' : '✗ missing'}\n`);
  });
}

start();
