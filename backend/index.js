import express from 'express';
import { db } from './db/config.js';
import { mainRouter } from './src/api/routes.js';
import { errorHandler } from './src/middleware/error-handler.js';
import cors from 'cors';

/** Express app: CORS, JSON body, `/health`, `/api`, then the error handler. */
const app = express();
/** HTTP port from `PORT`, or 3777. */
const port = process.env.PORT || 3777;

/**
 * Origins allowed to call this API from a browser.
 * `FRONTEND_URL` is the public site. `CORS_ORIGINS` adds more, comma-separated.
 * Localhost is included only outside production.
 *
 * @returns {string[]} Allowed Origin header values.
 */
const allowedOrigins = () => {
  const configured = [process.env.FRONTEND_URL, process.env.CORS_ORIGINS]
    .filter(Boolean)
    .join(',')
    .split(',')
    .map(origin => origin.trim())
    .filter(Boolean);

  if (process.env.NODE_ENV !== 'production') {
    configured.push('http://localhost:5173');
  }

  return [...new Set(configured)];
};

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins().includes(origin)) {
        callback(null, true);
        return;
      }
      callback(null, false);
    },
  }),
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date() });
});

app.use('/api', mainRouter);

app.use(errorHandler);

/**
 * Connects to MySQL, then listens on `port`.
 *
 * @returns {Promise<void>} Process stays running while the server is up.
 */
const startServer = async () => {
  try {
    const connection = await db.getConnection();

    console.log('Database connection established successfully.');
    connection.release();

    app.listen(port, '0.0.0.0', err => {
      if (err) {
        console.error('Failed to start the server:', err.message);
        process.exit(1);
      }
      console.log(`Server listening on port ${port}`);
    });
  } catch (error) {
    console.error(
      'Failed to connect to the database. Server not started.',
      error.message,
    );
    process.exit(1);
  }
};

startServer();
