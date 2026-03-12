// Vercel Serverless Function entry point
// This re-exports the Express app from backend for Vercel's /api directory requirement.
import app from '../backend/src/index.js';

export default app;
