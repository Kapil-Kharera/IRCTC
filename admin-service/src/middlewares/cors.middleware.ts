import cors, { type CorsOptions } from 'cors';
import { config } from '../config/index.js';

const allowedOrigins: string[] = config.ALLOWED_ORIGINS
    ? config.ALLOWED_ORIGINS.split(',').map((origin: string) => origin.trim())
    : [];

const corsOptions: CorsOptions = {
    origin: (origin, callback) => {
        if (!origin) {
            return callback(null, true);
        }

        if (allowedOrigins.includes(origin)) {
            return callback(null, true);
        }

        return callback(new Error('Not allowed by CORS'));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
};

const corsMiddleware = cors(corsOptions);

export { corsMiddleware };