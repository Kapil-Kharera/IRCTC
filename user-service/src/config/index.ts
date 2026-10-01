import dotenv from "dotenv";
import packageJsonFile from "../../package.json" with { type : "json"};

dotenv.config();

export const config = {
    SERVICE_NAME: packageJsonFile.name,
    PORT: Number(process.env.PORT) || 4001,
    NODE_ENV: process.env.NODE_ENV || "development",
    LOG_LEVEL: process.env.LOG_LEVEL || "info",
    DATABASE_URL: process.env.DATABASE_URL,
    REDIS_URL: process.env.REDIS_URL || "redis://:irctcpass@redis:6379",
    ALLOWED_ORIGINS: process.env.ALLOWED_ORIGINS || "http://localhost:4000",
    SENDGRID_API_KEY: process.env.SENDGRID_API_KEY,
    MAIL_SEND: process.env.MAIL_SEND || "johndoe@mail.com",
    OTP_TTL: process.env.OTP_TTL || "300",
    OTP_RATE_MAX_PER_HOUR: process.env.OTP_RATE_MAX_PER_HOUR || "5",
    OTP_MAX_VERIFY_ATTEMPTS: process.env.OTP_MAX_VERIFY_ATTEMPTS || "5",
    OTP_HMAC_SECRET: process.env.OTP_HMAC_SECRET || "e04e9053d56467efd48d4d97cfdf0225ca6e4aa91b917675a94191f19fcb9fbe"
}