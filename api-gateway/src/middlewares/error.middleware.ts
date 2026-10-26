import type { NextFunction, Request, Response } from "express";

// middlewares/error.middleware.js
import { AppError } from "../utils/error.js";
import { config } from "../config/index.js";
import { logger } from "../config/logger.js";

export default (err: any, req: Request, res: Response, next: NextFunction) => {
     if (err instanceof AppError) {
          return res.status(err.statusCode).json({
               success: false,
               error: err.code,
               message: err.message
          });
     }

     console.error("UNHANDLED ERROR:", err);

     if(config.NODE_ENV !== "production"){
          logger.error({
               message: err.message,
               stack: err.stack,
               path: req.path,
               method: req.method,
               body: req.body,
               query: req.query
          })
     }
     return res.status(500).json({
          success: false,
          error: "SERVER_ERROR",
          message: "Internal Server Error"
     });
};