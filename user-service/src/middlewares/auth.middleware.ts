

/**
 * Middleware to verify access token from Authorization header
 * This is going to be our authentication mechanism which will authenticate user
 * Extracts user ID and attaches it to request headers for downstream services
 */

import type { NextFunction, Request, Response } from "express";
import { UnauthorizedError } from "../utils/error";
import jwt, { type JwtPayload } from "jsonwebtoken";
import { config } from "../config";
import { logger } from "../config/logger";


export interface AuthRequest extends Request {
    user: {
        id: string;
    };
}


export function requireAuth(req: Request, res: Response, next: NextFunction) {
    try {
        let accessToken: string | undefined;

        // 1. Try Authorization header (service-to-service / mobile clients)
        const authHeader = req.headers.authorization;

        if (authHeader && authHeader.startsWith('Bearer ')) {
            accessToken = authHeader.split(' ')[1];
        }

        // 2. Fall back to httpOnly cookie (browser clients)
        if (!accessToken && req.cookies) {
            accessToken = req.cookies.accessToken;
        }

        if (!accessToken) {
            throw new UnauthorizedError('Authorization token missing');
        }

        //verify access token
        const payload = jwt.verify(accessToken, config.JWT_ACCESS_SECRET) as JwtPayload;

        if (!payload.id) {
            throw new UnauthorizedError('Invalid token payload');
        }

        // Attach user context to request for downstream services
        req.user = {
            id: String(payload.id)
        }

        // Add user ID to headers for proxied requests
        req.headers['x-user-id'] = String(payload.id);

        logger.debug(`User ${payload.id} authenticated successfully`);

        next();
    } catch (err: any) {
        if (err.name === 'TokenExpiredError') {
            return next(new UnauthorizedError('Access token expired', 'TOKEN_EXPIRED'));
        }

        if (err.name === 'JsonWebTokenError') {
            return next(new UnauthorizedError('Invalid access token', 'TOKEN_INVALID'));
        }

        return next(err);
    }
}