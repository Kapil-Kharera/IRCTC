import type { NextFunction, Request, Response } from "express";
import { AppError } from "../utils/error.js";

export const ErrorHandler = (err:unknown, req: Request, res: Response, next: NextFunction) => {
    if(err instanceof AppError) {
        return res.status(err.statusCode).json({
            success: false,
            error: err.code,
            message: err.message,
        })
    }

    console.log("UNHANDLED ERROR : ", err);
}
