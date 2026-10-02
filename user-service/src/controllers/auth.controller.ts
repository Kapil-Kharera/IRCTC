import type { Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import { BadRequestError, UnauthorizedError } from "../utils/error";
import { config } from "../config";
import authService from "../services/auth.service";
import { getDeviceFingerPrint } from "../utils/deviceFingerPrint";

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


export const login = asyncHandler(async (req: Request, res: Response) => {
    const { email, password } = req.body;

    if(!email || !password) {
        throw new BadRequestError("Email and password are required");
    }

    const deviceId = getDeviceFingerPrint(req);

    const { accessToken, refreshToken, loggedInUser } = await authService.login(email, password, deviceId);

    res.cookie("accessToken", accessToken, {
        httpOnly: true,
        secure: true,
        sameSite: "strict",
        maxAge: config.ACCESS_TOKEN_EXP_SEC * 1000
    });

    res.cookie("refreshToken", refreshToken, {
        httpOnly: true,
        secure: true,
        sameSite: "strict",
        maxAge: config.REFRESH_TOKEN_EXP_SEC * 1000
    });

    return res.status(200).json({
        success: true,
        message: "User Loggedin successfully",
        loggedInUser
    });
});


export const rotateRefreshToken = asyncHandler(async (req: Request, res: Response) => {
    const refreshToken = req.cookies.refreshToken;

    if(!refreshToken) {
        throw new UnauthorizedError("Refresh token is missing", "LOGIN AGAIN");
    }

    const deviceId = getDeviceFingerPrint(req);

    const { newAccessToken, newRefreshToken } = await authService.rotateRefreshToken(refreshToken, deviceId);

    res.cookie("accessToken", newAccessToken, {
        httpOnly: true,
        secure: true,
        sameSite: "strict",
        maxAge: config.ACCESS_TOKEN_EXP_SEC * 1000
    });

    res.cookie("refreshToken", newRefreshToken, {
        httpOnly: true,
        secure: true,
        sameSite: "strict",
        maxAge: config.REFRESH_TOKEN_EXP_SEC * 1000
    });

    return res.status(200).json({
        success: true,
        message: "Access & Refresh token is reissued"
    })
});

