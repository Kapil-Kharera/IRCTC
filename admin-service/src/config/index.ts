import dotenv from "dotenv";
dotenv.config();

import packageJsonFile from "../../package.json" with { type: "json"};


const DATABASE_URL = process.env.DATABASE_URL;
if(!DATABASE_URL) {
    throw new Error("Please set DATABASE_URL in admin service");
}


export const config = {
     PORT: Number(process.env.PORT) || 4003,
     SERVICE_NAME: packageJsonFile.name,
     NODE_ENV: process.env.NODE_ENV || 'development',
     LOG_LEVEL: process.env.LOG_LEVEL || 'info',
     KAFKA_BROKER: process.env.KAFKA_BROKER,
     KAFKA_CLIENT_ID: process.env.KAFKA_CLIENT_ID,
     DATABASE_URL,
     ALLOWED_ORIGINS: process.env.ALLOWED_ORIGINS,

     INTERNAL_SERVICE_KEY: process.env.INTERNAL_SERVICE_KEY,
}
