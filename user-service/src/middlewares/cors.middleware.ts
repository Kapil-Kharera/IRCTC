import cors from "cors";
import { config } from "../config/index.js";

const corsMiddleware = cors({
    origin: config.ALLOWED_ORIGINS.split(",").map((origin: string) => origin.trim()),

    credentials: true,

    methods: [
        "GET",
        "POST",
        "PUT",
        "PATCH",
        "DELETE",
        "OPTIONS"
    ],

    allowedHeaders: [
        "Origin",
        "X-Requested-With",
        "Content-Type",
        "Accept",
        "Authorization"
    ]
});

export { corsMiddleware };
