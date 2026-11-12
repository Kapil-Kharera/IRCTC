// middlewares/error.middleware.ts

import type { ErrorRequestHandler } from 'express';
import { AppError } from '../utils/error.js';
import { config } from '../config/index.js';
import logger from '../config/logger.js';

const errorMiddleware: ErrorRequestHandler = (
    err,
    req,
    res,
    _next
) => {
    if (err instanceof AppError) {
        return res.status(err.statusCode).json({
            success: false,
            error: err.code,
            message: err.message,
        });
    }

    const error = err instanceof Error ? err : new Error(String(err));

    if (config.NODE_ENV !== 'production') {
        logger.error({
            message: error.message,
            stack: error.stack,
            path: req.path,
            method: req.method,
            body: req.body,
            query: req.query,
        });
    }

    return res.status(500).json({
        success: false,
        error: 'SERVER_ERROR',
        message: 'Internal Server Error',
    });
};

export default errorMiddleware;