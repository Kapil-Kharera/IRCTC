
import cors, { type CorsOptions } from "cors";
import type { CorsOptionsDelegate } from "cors";
import { config } from "../config/index.js";

const allowedOrigins: string[] = config.ALLOWED_ORIGINS
    ? config.ALLOWED_ORIGINS.split(",").map(
          (origin: string) => origin.trim()
      )
    : [];

const corsOptions: CorsOptions = {
    origin: (
        origin: string | undefined,
        callback: (
            error: Error | null,
            allow?: boolean
        ) => void
    ): void => {
        // Allow requests without an Origin header
        if (!origin) {
            callback(null, true);
            return;
        }

        if (allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            callback(new Error("Not allowed by CORS"));
        }
    },

    credentials: true,

    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],

    allowedHeaders: ["Content-Type", "Authorization"],
};

export const corsMiddleware = cors(corsOptions);
