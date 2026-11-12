import "dotenv/config";

import express, {
  type Request,
  type Response,
  type NextFunction,
} from "express";

import helmet from "helmet";
import cookieParser from "cookie-parser";

import logger from "./config/logger.js";
import { config } from "./config/index.js";

import stationRoutes from "./routes/station.route.js";
import trainRoutes from "./routes/train.route.js";
import scheduleRoutes from "./routes/schedule.route.js";

import { corsMiddleware } from "./middlewares/cors.middleware.js";
import errorHandler from "./middlewares/error.middleware.js";
import { reqLogger } from "./middlewares/req.middleware.js";

import { disconnectProducer } from "./config/kafka.js";

const app = express();

app.use(corsMiddleware);

app.use(
  helmet({
    crossOriginOpenerPolicy: false,
    crossOriginEmbedderPolicy: false,
  })
);

app.use(reqLogger);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Request logging
app.use(
  (
    req: Request,
    _res: Response,
    next: NextFunction
  ) => {
    logger.info(`${req.method} ${req.path}`, {
      ip: req.ip,
      userAgent: req.get("user-agent"),
    });

    next();
  }
);

// Root endpoint
app.get("/", (_req: Request, res: Response) => {
  res.send("Hello from index.ts of admin-service");
});

// Health check
app.get("/health", (_req: Request, res: Response) => {
  return res.status(200).json({
    success: true,
    message: "Admin Service is healthy",
    timestamp: new Date().toISOString(),
  });
});

// API routes
app.use("/stations", stationRoutes);
app.use("/trains", trainRoutes);
app.use("/schedules", scheduleRoutes);

// Error handler must be registered last
app.use(errorHandler);

const startServer = async (): Promise<void> => {
  try {
    const server = app.listen(config.PORT, () => {
      logger.info(
        `${config.SERVICE_NAME} is running on port ${config.PORT}`
      );
    });

    let shuttingDown = false;

    const shutdown = async (): Promise<void> => {
      if (shuttingDown) return;
      shuttingDown = true;

      logger.info("Shutting down gracefully...");

      server.close(async (error) => {
        if (error) {
          logger.error("Error closing HTTP server", error);
          process.exitCode = 1;
        }

        try {
          await disconnectProducer();
          logger.info("Server closed");
        } catch (shutdownError) {
          logger.error(
            "Error disconnecting Kafka producer",
            shutdownError
          );
          process.exitCode = 1;
        }
      });
    };

    process.on("SIGTERM", () => {
      void shutdown();
    });

    process.on("SIGINT", () => {
      void shutdown();
    });
  } catch (error: unknown) {
    logger.error("Failed to start server", error);
    process.exitCode = 1;
  }
};

// Start the service only when this file is executed directly.
// Importing this module for tests won't start the server.
if (process.env.NODE_ENV !== "test") {
  void startServer();
}

export default app;
