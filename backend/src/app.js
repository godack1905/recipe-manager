import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import routes from './routes/index.js';

import { ApiError } from './messages/ApiError.js';
import { MESSAGE_CODES } from './messages/messageCodes.js';
import { errorMiddleware } from './middlewares/errorMiddleware.js';

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

    callback(
      new ApiError(
        403,
        MESSAGE_CODES.AUTH_UNAUTHORIZED,
        { origin }
      )
    );
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

app.use(errorMiddleware);
export default app;
