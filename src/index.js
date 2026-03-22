import express from 'express';
import { manifest } from './manifest.js';
import configureRouter from './routes/configure.js';
import catalogRouter from './routes/catalog.js';
import metaRouter from './routes/meta.js';
import streamRouter from './routes/stream.js';
import playRouter from './routes/play.js';

const app = express();
const PORT = process.env.PORT || 8000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

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
 * GET / - Root, redirect to configure
 */
app.get('/', (req, res) => {
  res.redirect('/configure');
});

/**
 * Configure routes
 */
app.use('/configure', configureRouter);

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
