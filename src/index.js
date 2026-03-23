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

// BASE_PATH: mount the entire addon under a subfolder (e.g., /tubio)
// Normalize: ensure leading slash, strip trailing slash, default to ''
let BASE_PATH = (process.env.BASE_PATH || '').trim();
if (BASE_PATH && !BASE_PATH.startsWith('/')) BASE_PATH = '/' + BASE_PATH;
if (BASE_PATH.endsWith('/')) BASE_PATH = BASE_PATH.slice(0, -1);

// Export for use in route files
export { BASE_PATH };

// Trust proxy (Pangolin / reverse proxy)
app.set('trust proxy', 1);

// Create a sub-router so all routes live under BASE_PATH
const router = express.Router();

// Middleware
router.use(express.json());
router.use(express.urlencoded({ extended: true }));

// --- Rate Limiting ---
// RATE_LIMIT env: "true"/"on"/"1" = enabled (default), "false"/"off"/"0" = disabled
const rateLimitEnabled = !['false', 'off', '0'].includes((process.env.RATE_LIMIT || 'on').toLowerCase());

if (rateLimitEnabled) {
  const playLimiter = rateLimit({ windowMs: 60_000, max: 15, message: 'Too many play requests, please slow down.' });
  const encryptLimiter = rateLimit({ windowMs: 60_000, max: 10, message: 'Too many encrypt requests, please slow down.' });
  const apiLimiter = rateLimit({ windowMs: 60_000, max: 60 });
  const globalLimiter = rateLimit({ windowMs: 60_000, max: 120, isGlobal: true });

  router.use('/play', playLimiter);
  router.use('/api/encrypt', encryptLimiter);
  router.use('/:config/stream', apiLimiter);
  router.use('/:config/catalog', apiLimiter);
  router.use('/:config/meta', apiLimiter);
  router.use(globalLimiter);
  console.log('[config] Rate limiting: ENABLED');
} else {
  console.log('[config] Rate limiting: DISABLED (RATE_LIMIT=' + process.env.RATE_LIMIT + ')');
}

// Request logging
router.use((req, res, next) => {
  if (req.path !== '/health') {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.baseUrl}${req.path}`);
  }
  next();
});

// CORS headers for all responses
router.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Expose-Headers', 'Content-Type, Content-Length');
  next();
});

// Handle OPTIONS requests
router.options('*', (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.status(200).end();
});

/**
 * GET /manifest.json - Addon manifest
 */
router.get(['/:config/manifest.json', '/manifest.json'], (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.json(manifest);
});

/**
 * Landing page, configure, and API routes
 */
router.use('/', configureRouter);

/**
 * API routes with config parameter
 */
router.use('/', catalogRouter);
router.use('/', metaRouter);
router.use('/', streamRouter);
router.use('/', playRouter);

/**
 * Health check endpoint
 */
router.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

/**
 * 404 handler
 */
router.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

/**
 * Error handler
 */
router.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  if (!res.headersSent) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Mount all routes under BASE_PATH (or '/' if no BASE_PATH set)
app.use(BASE_PATH || '/', router);

// If BASE_PATH is set, redirect root to the base path
if (BASE_PATH) {
  app.get('/', (req, res) => res.redirect(BASE_PATH));
}

const displayPath = BASE_PATH || '';

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`
╔════════════════════════════════════════════════════════════╗
║                                                            ║
║     YouTube for Stremio - Started Successfully            ║
║                                                            ║
║     Base Path:  ${(displayPath || '/').padEnd(40)}
║     Manifest:   http://0.0.0.0:${PORT}${displayPath}/manifest.json
║     Configure:  http://0.0.0.0:${PORT}${displayPath}/configure
║     Health:     http://0.0.0.0:${PORT}${displayPath}/health
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
