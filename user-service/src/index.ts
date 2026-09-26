import express, { type Express, type Request, type Response } from "express";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import { ErrorHandler } from "./middlewares/error.middleware.js";
import { corsMiddleware } from "./middlewares/cors.middleware.js";
import { config } from "./config/index.js";
import { logger } from "./config/logger.js";
import { reqLogger } from "./middlewares/req.middleware.js";


const app: Express = express();

app.use(helmet());
app.use(corsMiddleware);
app.use(reqLogger);
app.use(cookieParser());
app.use(express.json());


app.get("/", (req: Request, res: Response) => {
    res.send("Hello from user service....");
});


app.get("/health", (req: Request, res: Response) => {
    res.status(200).json({
        message: "OK"
    });
});


app.use(ErrorHandler);

const startServer = () => {
    const server = app.listen(config.PORT, () => {
        logger.info(`${config.SERVICE_NAME} is running on http://localhost:${config.PORT}`);
    });

    server.on("error", (error) => {
        logger.error("Failed to start server:", error);
        process.exit(1);
    });
};

startServer();
