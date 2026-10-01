
import { config } from "../config";
import { redis } from "../config/redis";
import { TooManyRequestsError } from "./error";
import otpGenerator from "otp-generator";
import crypto from "node:crypto";

const RATE_MAX = parseInt(config.OTP_RATE_MAX_PER_HOUR || '5', 10);
const ATTEMPTS_MAX = parseInt(config.OTP_MAX_VERIFY_ATTEMPTS || '5', 10);
const HMAC_SECRET = config.OTP_HMAC_SECRET;
const OTP_TTL = parseInt(config.OTP_TTL || '300', 10);

function hmacFor(email: string, otp: string) {
    return crypto.createHmac('sha256', HMAC_SECRET).update(email + ":" + otp).digest('hex');
}

export async function generateAndStoreOtp(meta: { firstName: string, lastName: string, email: string, hashedPassword: string }) {
    //how many otp you can send in an hour
    const rateKey = `otp:rate:${meta?.email}`;

    const sentCount = parseInt(await redis.get(rateKey) || '0', 10);

    if(sentCount >= RATE_MAX) {
        throw new TooManyRequestsError("Too many OTP request.Please try again, after some time.");
    }

    const otp = otpGenerator.generate(6, {
        upperCaseAlphabets: false,
        lowerCaseAlphabets: false,
        specialChars: false
    });

    const otpSessionId = crypto.randomUUID();

    const hashed = hmacFor(meta.email, otp);

    await redis.set(`otp:session:${otpSessionId}`, JSON.stringify({
        hashedOtp: hashed,
        meta
    }), 'EX', OTP_TTL);

    await redis.incr(rateKey);

    await redis.expire(rateKey, 3600);

    return { otp, otpSessionId };
}


export async function verifyOtpAndSessionId(otp: string, otpSessionId: string) {
    const rawData = await redis.get(`otp:session:${otpSessionId}`);

    if(!rawData) {
        return null;
    }

    const { hashedOtp: storedOtp, meta } = JSON.parse(rawData);

    const attemptsKey = `otp:attempts:${meta.email}`;

    const attemptsCount = parseInt(await redis.get(attemptsKey) || '0', 10);

    if(attemptsCount >= ATTEMPTS_MAX) {
        throw new TooManyRequestsError("Too many attempts to verify the otp");
    }

    const hashedOtp = hmacFor(meta.email, otp);

    if(crypto.timingSafeEqual(
        Buffer.from(hashedOtp, 'hex'),
        Buffer.from(storedOtp, 'hex')
    )) {
        await redis.del(`otp:session:${otpSessionId}`, attemptsKey);
        await redis.del(`otp:rate:${meta.email}`);
        return meta;
    }else {
        await redis.incr(attemptsKey);
        await redis.expire(attemptsKey, config.OTP_TTL);
        return null;
    }
}