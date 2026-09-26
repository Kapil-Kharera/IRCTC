import dotenv from "dotenv";
import packageJsonFile from "../../package.json" with { type : "json"};

dotenv.config();

export const config = {
    SERVICE_NAME: packageJsonFile.name,
    PORT: Number(process.env.PORT) || 4001,
    NODE_ENV: process.env.NODE_ENV || "development",
    LOG_LEVEL: process.env.LOG_LEVEL || "info",
    REDIS_URL: process.env.REDIS_URL || "redis://:irctcpass@redis:6379",
    ALLOWED_ORIGINS: process.env.ALLOWED_ORIGINS || "http://localhost:4000"
}