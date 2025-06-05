require('dotenv').config();
const express = require('express');
const path = require('path');
const cors = require('cors');

const app = express();
const PORT = process.env.FRONTEND_PORT || 8088;

// Middleware
app.use(cors());
app.use(express.static(path.join(__dirname, 'public')));

// Serve index.html for all routes to support client-side routing
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start server
app.listen(PORT, () => {
  console.log(`Frontend server running on http://localhost:${PORT}`);
  console.log(`API Server: ${process.env.API_URL || 'http://localhost:3001'}`);
});
