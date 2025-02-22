// server.js
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const contactRoutes = require('./contact');

const app = express();
const PORT = process.env.PORT || 3000;

// Enable CORS
app.use(cors());

// Parse JSON bodies (built-in middleware)
app.use(express.json());

// Serve static files (e.g., your portfolio HTML/CSS/JS) from the "public" folder
app.use(express.static('public'));

// Mount the contact routes under /api/contact
app.use('/api/contact', contactRoutes);

// Global error handling middleware
app.use((err, req, res, next) => {
  console.error('Unexpected error:', err);
  res.status(500).json({ message: 'An unexpected error occurred.' });
});

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
// In this example, we have a server.js file that sets up an Express server with CORS support, JSON body parsing, and serves static files from the public folder.
