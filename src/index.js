import express from 'express';
import { manifest } from './manifest.js';
import { rateLimit } from './middleware/rateLimit.js';
import configureRouter from './routes/configure.js';
import catalogRouter from './routes/catalog.js';
import metaRouter from './routes/meta.js';
import streamRouter from './routes/stream.js';
import playRouter from './routes/play.js';

const app = express();
const PORT = process.env.PORT || 8000;

// Trust proxy (Pangolin / reverse proxy)
app.set('trust proxy', 1);

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// --- Rate Limiting ---
// RATE_LIMIT env: "true"/"on"/"1" = enabled (default), "false"/"off"/"0" = disabled
const rateLimitEnabled = !['false', 'off', '0'].includes((process.env.RATE_LIMIT || 'on').toLowerCase());

if (rateLimitEnabled) {
  // Play endpoint: heaviest (spawns FFmpeg), strict limit
  const playLimiter = rateLimit({ windowMs: 60_000, max: 15, message: 'Too many play requests, please slow down.' });
  // API encrypt endpoint: prevent brute-force config abuse
  const encryptLimiter = rateLimit({ windowMs: 60_000, max: 10, message: 'Too many encrypt requests, please slow down.' });
  // Stremio API endpoints (stream, catalog, meta): moderate limit
  const apiLimiter = rateLimit({ windowMs: 60_000, max: 60 });
  // Global fallback: generous overall limit (skipped if a specific limiter already ran)
  const globalLimiter = rateLimit({ windowMs: 60_000, max: 120, isGlobal: true });

  app.use('/play', playLimiter);
  app.use('/api/encrypt', encryptLimiter);
  app.use('/:config/stream', apiLimiter);
  app.use('/:config/catalog', apiLimiter);
  app.use('/:config/meta', apiLimiter);
  app.use(globalLimiter);
  console.log('[config] Rate limiting: ENABLED');
} else {
  console.log('[config] Rate limiting: DISABLED (RATE_LIMIT=' + process.env.RATE_LIMIT + ')');
}

// Request logging
app.use((req, res, next) => {
  if (req.path !== '/health') {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  }
  next();
});

// CORS headers for all responses
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Expose-Headers', 'Content-Type, Content-Length');
  next();
});

// Handle OPTIONS requests
app.options('*', (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.status(200).end();
});

/**
 * GET /manifest.json - Addon manifest
 */
app.get(['/:config/manifest.json', '/manifest.json'], (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.json(manifest);
});

/**
 * Landing page, configure, and API routes
 */
app.use('/', configureRouter);

/**
 * API routes with config parameter
 */
app.use('/', catalogRouter);
app.use('/', metaRouter);
app.use('/', streamRouter);
app.use('/', playRouter);

/**
 * Health check endpoint
 */
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

/**
 * 404 handler
 */
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

/**
 * Error handler
 */
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  if (!res.headersSent) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`
╔════════════════════════════════════════════════════════════╗
║                                                            ║
║     YouTube for Stremio - Started Successfully            ║
║                                                            ║
║     Manifest:   http://0.0.0.0:${PORT}/manifest.json
║     Configure:  http://0.0.0.0:${PORT}/configure
║     Health:     http://0.0.0.0:${PORT}/health
║                                                            ║
╚════════════════════════════════════════════════════════════╝
  `);
});

// Handle uncaught errors
process.on('uncaughtException', (err) => {
  console.error('Uncaught exception:', err);
  process.exit(1);
});

process.on('unhandledRejection', (err) => {
  console.error('Unhandled rejection:', err);
  process.exit(1);
});
