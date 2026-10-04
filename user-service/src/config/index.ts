import dotenv from "dotenv";
import packageJsonFile from "../../package.json" with { type: "json"};
import jwt from "jsonwebtoken";

dotenv.config();


const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;

if (!GOOGLE_CLIENT_ID) {
    throw new Error("GOOGLE_CLIENT_ID environment variable is required");
}

if (!GOOGLE_CLIENT_SECRET) {
    throw new Error("GOOGLE_CLIENT_SECRET environment variable is required");
}

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
    OTP_HMAC_SECRET: process.env.OTP_HMAC_SECRET || "e04e9053d56467efd48d4d97cfdf0225ca6e4aa91b917675a94191f19fcb9fbe",

    JWT_ACCESS_SECRET: process.env.JWT_ACCESS_SECRET || "6629fbfe2772509e5071a0b0091e502e92efb5d4151f199ba81dd22be8d1ac31",
    JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET || "f0b557152a5081a4f0528b81f471b985397dde01fee83e6a8d96d365f6d47b8f",

    ACCESS_TOKEN_EXP: (process.env.ACCESS_TOKEN_EXP || "15m") as NonNullable<jwt.SignOptions["expiresIn"]>,
    REFRESH_TOKEN_EXP: (process.env.REFRESH_TOKEN_EXP || "7d") as NonNullable<jwt.SignOptions["expiresIn"]>,

    ACCESS_TOKEN_EXP_SEC: Number(process.env.ACCESS_TOKEN_EXP_SEC || 900),
    REFRESH_TOKEN_EXP_SEC: Number(process.env.REFRESH_TOKEN_EXP_SEC || 604800),
    REDIS_USER_TTL: Number(process.env.REDIS_USER_TTL || 86400),

    GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET
}
