/**
 * Google File Search RAG Server - TypeScript Entry Point
 *
 * Note: This is the TypeScript version of the server.
 * The original server.js is still functional and can be used until
 * the full migration is complete.
 */

import { config, initializeFirebase, initializeOpenAI } from './config';
import { createApp } from './app';

// Initialize services
console.log('🚀 서버 시작 중...');

// Initialize Firebase
const db = initializeFirebase();

// Initialize OpenAI
const openaiClient = initializeOpenAI();

// Create Express app
const app = createApp();

// Health check endpoint
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    apiKeyConfigured: !!config.geminiApiKey,
    firebaseConnected: !!db,
    openaiConnected: !!openaiClient,
    version: 'typescript',
  });
});

// TODO: Import and register routes
// import storesRouter from './routes/stores.routes';
// import documentsRouter from './routes/documents.routes';
// import ragRouter from './routes/rag.routes';
// import enginesRouter from './routes/engines.routes';
// import problemsRouter from './routes/problems.routes';
//
// app.use('/api/store', storesRouter);
// app.use('/api/stores', storesRouter);
// app.use('/api/documents', documentsRouter);
// app.use('/api/rag', ragRouter);
// app.use('/api/engines', enginesRouter);
// app.use('/api/problems', problemsRouter);

// Start server
const PORT = config.port;

app.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════════════════════════════╗
║           Google File Search RAG Server (TypeScript)       ║
╠════════════════════════════════════════════════════════════╣
║  Port: ${PORT}                                               ║
║  Environment: ${config.nodeEnv.padEnd(42)}║
║  Gemini API: ${config.geminiApiKey ? '✅ Configured' : '❌ Not configured'}                              ║
║  OpenAI API: ${openaiClient ? '✅ Connected' : '⚠️  Not configured'}                               ║
║  Firebase: ${db ? '✅ Connected' : '⚠️  Not configured'}                                 ║
╚════════════════════════════════════════════════════════════╝
  `);
});

export { app, db, openaiClient };
