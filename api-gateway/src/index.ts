import dotenv from "dotenv";
dotenv.config();

import express from "express";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import morgan from "morgan";
import { config } from "./config/index.js";
import { logger } from "./config/logger.js";
import errorHandler from "./middlewares/error.middleware.js";
import { notFound } from "./middlewares/notFound.middleware.js";
import { reqLogger } from "./middlewares/req.middleware.js";
import { corsMiddleware } from "./middlewares/cors.middleware.js";
import routes from "./routes/index.js";


const app = express();

app.use(corsMiddleware);
app.use(helmet({
     crossOriginOpenerPolicy: false,
     crossOriginEmbedderPolicy: false,
}));
app.use(reqLogger);

// Skip JSON parsing for Razorpay webhook — signature verification needs raw bytes
app.use((req, res, next) => {
     if (req.path === '/api/payments/webhooks/razorpay') {
          return express.raw({ type: 'application/json', limit: '10mb' })(req, res, next);
     }
     express.json({ limit: '10mb' })(req, res, next);
});
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

if (config.NODE_ENV === 'development') {
     app.use(morgan('dev'));
}

app.get('/health', (req, res) => {
     res.status(200).json({
          success: true,
          message: 'API Gateway is running',
          timestamp: new Date().toISOString(),
          environment: config.NODE_ENV,
     });
});

app.use('/api', routes);

app.use(notFound);
app.use(errorHandler);

const gracefulShutdown = () => {
     logger.info('Received shutdown signal, closing server gracefully...');
     server.close(() => {
          logger.info('Server closed');
          process.exit(0);
     });

     setTimeout(() => {
          logger.error('Forced shutdown after timeout');
          process.exit(1);
     }, 30000);
};

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

const server = app.listen(config.PORT, () => {
     logger.info(`🚀 API Gateway running on port ${config.PORT} in ${config.NODE_ENV} mode`);
});

process.on('unhandledRejection', (err) => {
     logger.error('Unhandled Rejection:', err);
     server.close(() => process.exit(1));
});

module.exports = app;