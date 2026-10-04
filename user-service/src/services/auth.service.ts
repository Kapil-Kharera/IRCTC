import { prisma } from "../config/prisma"
import { sendOtpMail, verifyOtpMail } from "../utils/email";
import { BadRequestError, ConflictError, ForbiddenError, UnauthorizedError } from "../utils/error";
import bcrypt from "bcrypt";
import { generateAndStoreOtp, verifyOtpAndSessionId } from "../utils/otp";
import { generateAccessToken, generateRefreshToekn, verifyRefreshToken } from "../utils/auth";
import jwt from "jsonwebtoken";
import { redis } from "../config/redis";
import { config } from "../config";
import { OAuth2Client } from "google-auth-library";

const client = new OAuth2Client(config.GOOGLE_CLIENT_ID);



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

    if (!storedJti) {
        throw new ForbiddenError("Session Expired", "LOGIN AGAIN");
    }

    if (storedJti !== jti) {
        await redis.del(`refresh:${userId}:${deviceId}`);
        throw new ForbiddenError("Refresh token is reused", "LOGIN AGAIN");
    }

    const newAccessToken = generateAccessToken(userId);
    const newRefreshToken = generateRefreshToekn(userId);

    const { jti: newJti } = jwt.decode(newRefreshToken) as jwt.JwtPayload & { jti: string };

    await redis.set(`refresh:${userId}:${deviceId}`, newJti, 'EX', config.REFRESH_TOKEN_EXP_SEC);

    return { newAccessToken, newRefreshToken };
}

const verifyGoogleIdToken = async (idToken: string, deviceId: string) => {
    const ticket = await client.verifyIdToken({
        idToken,
        audience: config.GOOGLE_CLIENT_ID
    });

    const payload = ticket.getPayload();

    if (!payload?.sub || !payload?.email) {
        throw new UnauthorizedError("Invalid Google Auth Token");
    }

    const googleUser = {
        provider: payload.iss,
        providerId: payload.sub,
        email: payload.email,
        firstName: payload.given_name,
        lastName: payload.family_name,
        emailVerified: payload.email_verified || false,
    }

    const user = await prisma.$transaction(async (txn: any) => {
        let googleAuth = await txn.authProvider.findUnique({
            where: {
                provider_providerId: {
                    provider: googleUser.provider,
                    providerId: googleUser.providerId
                }
            },
            include: { user: true }
        });

        if (googleAuth) {
            return googleAuth.user;
        }

        let existingUser = await txn.user.findUnique({
            where: {
                email: googleUser.email
            }
        });

        if (existingUser) {
            await txn.authProvider.create({
                data: {
                    provider: googleUser.provider,
                    providerId: googleUser.providerId,
                    userId: existingUser.id
                }
            });

            return existingUser;
        }

        return await txn.user.create({
            email: googleUser.email,
            firstName: googleUser.firstName,
            lastName: googleUser.lastName,
            emailVerified: googleUser.emailVerified,
            AuthProviders: {
                create: {
                    provider: googleUser.provider,
                    providerId: googleUser.providerId
                }
            }
        })
    });

    const accessToken = generateAccessToken(user.id);
    const refreshToken = generateRefreshToekn(user.id);

    const { jti } = jwt.decode(refreshToken) as jwt.JwtPayload & { jti: string };

    await redis.set(`refresh:${user.id}:${deviceId}`, jti, 'EX', config.REFRESH_TOKEN_EXP_SEC);

    const { password: _password, ...safeUser } = user;

    await redis.set(`user:${user.id}`, JSON.stringify(safeUser), 'EX', config.REDIS_USER_TTL);

    return { accessToken, refreshToken, loggedInUser: safeUser };
}

export default { sendOTP, verifyOTP, login, rotateRefreshToken, verifyGoogleIdToken };