import type { Request, Response, NextFunction } from 'express';
import { config } from '../config/index.js';
import { ForbiddenError } from '../utils/error.js';

export const internalAuth = (
    req: Request,
    _res: Response,
    next: NextFunction
): void => {
    const serviceKey = req.headers['x-internal-service-key'];

    if (!serviceKey ||
        Array.isArray(serviceKey) ||
        serviceKey !== config.INTERNAL_SERVICE_KEY
    ) {
        return next(new ForbiddenError('Invalid or missing internal service key'));
    }

    next();
};