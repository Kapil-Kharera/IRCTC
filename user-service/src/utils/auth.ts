import jwt from "jsonwebtoken";
import { config } from "../config";
import crypto from "node:crypto";

const generateAccessToken = (userId: string) => {
    const payload = { id: userId };

    return jwt.sign(payload, config.JWT_ACCESS_SECRET, { expiresIn: config.ACCESS_TOKEN_EXP });
}

const generateRefreshToekn = (userId: string) => {
    const payload = {
        id: userId,
        jti: crypto.randomUUID() //jti -> jwt identifier => user to identify jwt tokens
    }

    return jwt.sign(payload, config.JWT_REFRESH_SECRET, { expiresIn: config.REFRESH_TOKEN_EXP });
}

const verifyAccessToken = (accessToken: string) => {
    return jwt.verify(accessToken, config.JWT_ACCESS_SECRET);
}

const verifyRefreshToken = (refreshToken: string) => {
    return jwt.verify(refreshToken, config.JWT_REFRESH_SECRET);
}

export { generateAccessToken, generateRefreshToekn, verifyAccessToken, verifyRefreshToken };