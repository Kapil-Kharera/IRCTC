import type { Request, Response, NextFunction } from 'express';
import { UnauthorizedError } from '../utils/error.js';

interface AuthenticatedRequest extends Request {
    user?: {
        id: string;
    };
}

export function getUserContext(
    req: AuthenticatedRequest,
    _res: Response,
    next: NextFunction
): void {
    const userId = req.headers['x-user-id'];

    if (!userId || Array.isArray(userId)) {
        return next(new UnauthorizedError('User context missing - must come through gateway'));
    }

    req.user = { id: userId };
    
    next();
}