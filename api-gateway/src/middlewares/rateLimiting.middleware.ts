/**
 * Rate limiting strategies:
 * 1. IP-based rate limiting (for unauthenticated users)
 * 2. User-based rate limiting (for authenticated users)
 * 3. Endpoint-specific rate limiting
 */

import { redis } from "../config/redis.js";
import { config } from "../config/index.js";
import { TooManyRequestsError } from "../utils/error.js";
import { logger } from "../config/logger.js";
import type { NextFunction, Request, Response } from "express";


/**
 * Generic rate limiter using sliding window algorithm
**/
async function rateLimiter(key: string, maxRequests: number, windowMs: number) {
    const now = Date.now();
    const windowStart = now - windowMs;

    try {
        //use redis pipeline for atomic operations
        const pipeline = redis.pipeline();

        //remove old entries outside the curr window
        pipeline.zremrangebyscore(key, 0, windowStart);

        //add curr req
        pipeline.zadd(key, now, `${now}-${Math.random()}`);

        //count requests in curr window
        pipeline.zcard(key);

        //set expiry on the key
        pipeline.expire(key, Math.ceil(windowMs / 1000));

        const results: any = await pipeline.exec();

        const requestCount = results[2][1];

        if (requestCount > maxRequests) {
            const oldestRequest = await redis.zrange(key, "0", "0", 'WITHSCORES');
            const resetTime = parseInt(oldestRequest[1]) + windowMs;
            const retryAfter = Math.ceil((resetTime - now) / 1000);

            return {
                allowed: false,
                remaining: 0,
                resetTime,
                retryAfter
            }
        }

        return {
            allowed: true,
            remaining: maxRequests - requestCount,
            resetTime: windowStart + windowMs
        }
    } catch (err: any) {
        logger.error('Rate limiter error:', err);
        // Fail open - allow request if Redis is down
        return { allowed: true, remaining: maxRequests };
    }
}


/**
 * IP-based rate limiting middleware
 * Default: 100 requests per 15 minutes
 */
function ipRateLimit(options: any = {}) {
    const maxRequests = options.max || config.RATE_LIMIT_MAX_REQUESTS;
    const windowMs = options.windowMs || config.RATE_LIMIT_WINDOW_MS;

    return async (req: Request, res: Response, next: NextFunction) => {
        const ip = req.ip || req.socket.remoteAddress;
        const key = `ratelimit:ip:${ip}`;

        const result = await rateLimiter(key, maxRequests, windowMs);

        //set rate limit headers
        res.setHeader('X-RateLimit-Limit', maxRequests);
        res.setHeader('X-RateLimit-Remaining', result.remaining);

        if (result.resetTime !== undefined) {
            res.setHeader(
                'X-RateLimit-Reset',
                new Date(result.resetTime).toISOString()
            );
        }

        if (!result.allowed) {
            const retryAfter = result.retryAfter ?? 60;

            res.setHeader('Retry-After', retryAfter);

            logger.warn(`Rate limit exceeded for IP : ${ip}`);

            return next(
                new TooManyRequestsError(
                    `Too many requests. Please try again in ${result.retryAfter} seconds`,
                    result.retryAfter
                )
            )
        }

        next();
    }
}


/**
 * User-based rate limiting middleware
 * Should be used after authentication middleware
 * Default: 1000 requests per 15 minutes (more lenient than IP-based)
**/
function userRateLimit(options: any = {}) {
    const maxRequests = options.max || config.RATE_LIMIT_MAX_REQUESTS * 10;
    const windowMs = options.windowMs || config.RATE_LIMIT_WINDOW_MS;

    return async (req: any, res: Response, next: NextFunction) => {
        //skip if no user authenticated
        if (!req.user || !req.user.id) {
            return next();
        }

        const userId = req.user.id;
        const key = `ratelimit:user:${userId}`;

        const result = await rateLimiter(key, maxRequests, windowMs);

        res.setHeader('X-RateLimit-Limit', maxRequests);
        res.setHeader('X-RateLimit-Remaining', result.remaining);
        if (result.resetTime !== undefined) {
            res.setHeader(
                'X-RateLimit-Reset',
                new Date(result.resetTime).toISOString()
            );
        }

        if (!result.allowed) {
            const retryAfter = result.retryAfter ?? 60;
            res.setHeader('Retry-After', retryAfter);
            logger.warn(`Rate limit exceeded for user: ${userId}`);
            return next(
                new TooManyRequestsError(
                    `Too many requests. Please try again in ${result.retryAfter} seconds`,
                    result.retryAfter
                )
            );
        }

        next();
    }
}


/**
 * Endpoint-specific rate limiting
 * Example: POST /api/auth/send-otp - 5 requests per hour
**/
function endpointRateLimit(maxRequests: number, windowMs: number) {
    return async (req: Request, res: Response, next: NextFunction) => {
        const ip = req.ip || req.socket.remoteAddress;
        const endpoint = `${req.method}:${req.path}`;
        const key = `ratelimit:endpoint:${endpoint}:${ip}`;

        const result = await rateLimiter(key, maxRequests, windowMs);

        res.setHeader('X-RateLimit-Limit', maxRequests);
        res.setHeader('X-RateLimit-Remaining', result.remaining);
        if (result.resetTime !== undefined) {
            res.setHeader(
                'X-RateLimit-Reset',
                new Date(result.resetTime).toISOString()
            );
        }

        if (!result.allowed) {
            const retryAfter = result.retryAfter ?? 60;
            res.setHeader('Retry-After', retryAfter);
            logger.warn(`Endpoint rate limit exceeded for ${endpoint} from IP: ${ip}`);
            return next(
                new TooManyRequestsError(
                    `Too many requests to this endpoint. Please try again in ${result.retryAfter} seconds`,
                    result.retryAfter
                )
            );
        }

        next();
    };
}



/**
 * Combined rate limiting strategy
 * Applies both IP and user-based rate limiting
**/
function combinedRateLimit(ipOptions: any = {}, userOptions: any = {}) {
     const ipLimiter = ipRateLimit(ipOptions);
     const userLimiter = userRateLimit(userOptions);

     return async (req: Request, res: Response, next: NextFunction) => {
          // Apply IP rate limit first
          ipLimiter(req, res, (err) => {
               if (err) return next(err);

               // Then apply user rate limit if authenticated
               userLimiter(req, res, next);
          });
     };
}


export {
     ipRateLimit,
     userRateLimit,
     endpointRateLimit,
     combinedRateLimit,
};