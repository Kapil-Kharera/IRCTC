import jwt, { type JwtPayload } from "jsonwebtoken";
import type { NextFunction, Request, Response } from "express";
import { config } from "../config/index.js";
import { UnauthorizedError } from "../utils/error.js";
import { logger } from "../config/logger.js";

/**
 * Middleware to verify access token from Authorization header
 * This is going to be our authentication mechanism which will authenticate user
 * Extracts user ID and attaches it to request headers for downstream services
 */
export function requireAuth(req: any, res: Response, next: NextFunction) {
     try {
          let accessToken;

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

          // Verify access token
          const payload = jwt.verify(accessToken, config.JWT_ACCESS_SECRET) as JwtPayload;

          if (!payload.id) {
               throw new UnauthorizedError('Invalid token payload');
          }

          // Attach user context to request for downstream services
          req.user = {
               id: payload.id,
          };

          // Add user ID to headers for proxied requests
          req.headers['x-user-id'] = payload.id.toString();

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
