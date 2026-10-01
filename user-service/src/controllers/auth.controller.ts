import type { Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import { BadRequestError } from "../utils/error";
import { config } from "../config";
import authService from "../services/auth.service";

const OTP_TTL = parseInt(config.OTP_TTL || '300', 10);

export const sendOtp = asyncHandler(async (req: Request, res: Response) => {
    const { firstName, lastName, email, password, confirmPassword } = req.body;

    if(!firstName || !lastName || !email || !password || !confirmPassword) {
        throw new BadRequestError("All fields are manadatory");
    }

    if(password != confirmPassword) {
        throw new BadRequestError("Password mismatch");
    }

    const otpSessionId = await authService.sendOTP(firstName, lastName, email, password);

    res.cookie("otp_session", otpSessionId, {
        httpOnly: true,
        secure: true,
        sameSite: "strict",
        maxAge: OTP_TTL * 1000
    }).status(200).json({
        success: true,
        message: "Otp send successfully"
    })
});


export const verifyOtp = asyncHandler(async (req: Request, res: Response) => {
    const { otp } = req.body;
    const otpSessionId = req.cookies.otp_session;

    if(!otp || !otpSessionId) {
        throw new BadRequestError("Otp or OtpSession is missing");
    }

    const user = await authService.verifyOTP(otp, otpSessionId);

    return res.status(201).json({
        success: true,
        message: "User Account is created successfully",
        data: user
    });
});

