import dotenv from "dotenv";
import parsedJsonFile from "../../package.json" with { type: "json"};

dotenv.config();

const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY;
if (!SENDGRID_API_KEY) {
    throw new Error("SENDGRID_API_KEY is missing. Please set value.");
}

const MAIL_SEND = process.env.MAIL_SEND;
if(!MAIL_SEND) {
    throw new Error("MAIL_SEND is missing. Please set value.")
}

const KAFKA_CLIENT_ID = process.env.KAFKA_CLIENT_ID;
if(!KAFKA_CLIENT_ID) {
    throw new Error("KAFKA_CLIENT_ID is missing. Please set value.");
}

const RESEND_API_KEY = process.env.RESEND_API_KEY;
if(!RESEND_API_KEY) {
    throw new Error("RESEND_API_KEY is missing. Please set value.");
}

export const config = {
    SERVICE_NAME: parsedJsonFile.name,
    PORT: Number(process.env.PORT) || 4004,
    NODE_ENV: process.env.NODE_ENV || "development",
    LOG_LEVEL: process.env.LOG_LEVEL || "info",
    ALLOWED_ORIGINS: process.env.ALLOWED_ORIGINS,
    SENDGRID_API_KEY,
    KAFKA_BROKER: process.env.KAFKA_BROKER,
    KAFKA_CLIENT_ID,
    MAIL_SEND,
    RESEND_API_KEY,
    FRONTEND_URL: process.env.FRONTEND_URL
}
