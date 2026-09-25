import { createApp } from './server/app';
import path from 'path';
import express from 'express';
import dotenv from 'dotenv';
import { initRepositories } from './server/repositories';

dotenv.config();

const port = process.env.PORT || 3000;
const app = createApp();

// Initialize repositories based on environment
initRepositories(process.env.DEMO_MODE === 'true');

// In production, serve the built Vite static assets
if (process.env.NODE_ENV === 'production') {
  const distDir = path.resolve(process.cwd(), 'dist');
  app.use(express.static(distDir));

  // Forward every non-API request to index.html for React Router
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api/')) {
      return next();
    }
    res.sendFile(path.join(distDir, 'index.html'));
  });
}

// Start HTTP server if run directly
if (process.env.NODE_ENV === 'production' || process.env.START_STANDALONE === 'true') {
  app.listen(port, () => {
    console.log(`[CCIA Server] Server running on port ${port}`);
  });
}

export default app;
