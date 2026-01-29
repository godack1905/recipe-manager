import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import routes from './routes/index.js';

const app = express();

const allowedHostnames = (process.env.CORS_HOSTNAMES || '')
  .split(',')
  .map(h => h.trim())
  .filter(Boolean);

console.log('CORS HOSTNAMES:', allowedHostnames);

app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);

    try {
      const { hostname } = new URL(origin);

      if (allowedHostnames.includes(hostname)) {
        return callback(null, true);
      }
    } catch (e) {
    }

    callback(new Error(`CORS bloqueado: ${origin}`));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());
app.use(morgan('dev'));
app.use('/uploads', express.static('uploads'));
app.use('/api', routes);

app.get('/health', (_, res) => {
  res.json({ status: 'ok' });
});

export default app;
