import express, { type Request, type Response } from "express";
import { requireAuth } from "../middlewares/auth.middleware.js";
import { ipRateLimit, endpointRateLimit, combinedRateLimit } from "../middlewares/rateLimiting.middleware.js";
import { config } from "../config/index.js";
import { createProxy } from "../services/proxy.js";

const router = express.Router();

const userServiceProxy = createProxy('userService', config.SERVICES.USER_SERVICE_URL);

//public routes
router.post(
    '/users/auth/login',
    endpointRateLimit(10, 900000), // 10 requests per 15 min
    userServiceProxy
);

//private routes
router.get(
    '/users/user/profile',
    requireAuth,
    combinedRateLimit(),
    userServiceProxy
);


//gateway health
router.get('/gateway/health', (req: Request, res: Response) => {
    res.status(200).json({
        success: true,
        message: "API Gateway is healthy",
        timestamp: new Date().toString()
    })
});


export default router;