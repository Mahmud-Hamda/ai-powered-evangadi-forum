import express from 'express';
import authRoutes from './auth/routes/auth.routes.js';
import answerRoutes from './answer/routes/answer.route.js';
import questionRoutes from './question/routes/question.route.js';
import ragRoutes from './rag/routes/rag.route.js';

/**
 * Root API router mounted at `/api`.
 * - `/api/auth` — register and login
 * - `/api/answers` — answer CRUD
 * - `/api/questions` — questions, search, AI coach
 * - `/api/rag` — private PDF library, semantic search, and Ask AI
 *
 * @type {import('express').Router}
 */
export const mainRouter = express.Router();

mainRouter.use('/auth', authRoutes);
mainRouter.use('/answers', answerRoutes);
mainRouter.use('/questions', questionRoutes);
mainRouter.use('/rag', ragRoutes);
