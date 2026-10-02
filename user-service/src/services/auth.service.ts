import { prisma } from "../config/prisma"
import { sendOtpMail, verifyOtpMail } from "../utils/email";
import { BadRequestError, ConflictError, ForbiddenError } from "../utils/error";
import bcrypt from "bcrypt";
import { generateAndStoreOtp, verifyOtpAndSessionId } from "../utils/otp";
import { generateAccessToken, generateRefreshToekn, verifyRefreshToken } from "../utils/auth";
import jwt from "jsonwebtoken";
import { redis } from "../config/redis";
import { config } from "../config";



const sendOTP = async (firstName: string, lastName: string, email: string, password: string) => {
    const isUserExisted = await prisma.user.findUnique({
        where: { email }
    });

    if (isUserExisted) {
        throw new ConflictError("User is already existed");
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    const meta = { firstName, lastName, email, hashedPassword };

    const { otp, otpSessionId } = await generateAndStoreOtp(meta);

    await sendOtpMail(otp, email);

    return otpSessionId;
}


const verifyOTP = async (otp: string, otpSessionId: string) => {
    const meta = await verifyOtpAndSessionId(otp, otpSessionId);

    if (meta == null) {
        throw new BadRequestError("Invalid or expired OTP", "OTP_INVALID");
    }

    const user = await prisma.user.create({
        data: {
            firstName: meta.firstName,
            lastName: meta.lastName,
            email: meta.email,
            password: meta.hashedPassword,
            emailVerified: true
        }
    });

    await verifyOtpMail(meta);

    return user;
}


const login = async (email: string, password: string, deviceId: string) => {
    const isUserExisted = await prisma.user.findUnique({
        where: { email }
    });

    if (!isUserExisted) {
        throw new BadRequestError("Email not found");
    }

    const isPasswordMatched = await bcrypt.compare(password, isUserExisted.password!);

    if (!isPasswordMatched) {
        throw new BadRequestError("Password is incorrect");
    }

    const accessToken = generateAccessToken(isUserExisted.id);
    const refreshToken = generateRefreshToekn(isUserExisted.id);

    const { jti } = jwt.decode(refreshToken) as jwt.JwtPayload & { jti: string };

    await redis.set(`refresh:${isUserExisted.id}:${deviceId}`, jti, 'EX', config.REFRESH_TOKEN_EXP_SEC);

    const { password: _password, ...safeUser } = isUserExisted;

    await redis.set(`user:${isUserExisted.id}`, JSON.stringify(safeUser), 'EX', config.REDIS_USER_TTL);

    return { accessToken, refreshToken, loggedInUser: safeUser };
}


const rotateRefreshToken = async (refreshToken: string, deviceId: string) => {
    const payload = verifyRefreshToken(refreshToken);

    const { id: userId, jti } = payload as jwt.JwtPayload;

    const storedJti = await redis.get(`refresh:${userId}:${deviceId}`);

    if(!storedJti) {
        throw new ForbiddenError("Session Expired", "LOGIN AGAIN");
    }

    if(storedJti !== jti) {
        await redis.del(`refresh:${userId}:${deviceId}`);
        throw new ForbiddenError("Refresh token is reused", "LOGIN AGAIN");
    }

    const newAccessToken = generateAccessToken(userId);
    const newRefreshToken = generateRefreshToekn(userId);

    const { jti: newJti } = jwt.decode(newRefreshToken) as jwt.JwtPayload & { jti: string };

    await redis.set(`refresh:${userId}:${deviceId}`, newJti, 'EX', config.REFRESH_TOKEN_EXP_SEC);

    return { newAccessToken, newRefreshToken };
}

export default { sendOTP, verifyOTP, login, rotateRefreshToken };