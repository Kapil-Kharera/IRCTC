import { config } from "../config";
import { logger } from "../config/logger"
import { prisma } from "../config/prisma";
import { redis } from "../config/redis";


const getProfile = async (userId: string) => {
    logger.info("First check user in the redis");

    const savedUser = await redis.get(`user:${userId}`);

    if (savedUser) {
        logger.info("Fetched user profile from the redis");

        return JSON.parse(savedUser);
    }

    logger.info("If user is not in redis, it is fetched from db");

    const userProfile = await prisma.user.findUnique({
        where: {
            id: userId
        }
    });

    if (!userProfile) {
        throw new Error("User profile not found");
    }

    logger.info("Exclude password field from the user");

    const { password: _password, ...safeUser } = userProfile;

    logger.info("Store user profile in redis for future lookup");

    await redis.set(`user:${userId}`, JSON.stringify(safeUser), 'EX', config.REDIS_USER_TTL);

    return safeUser;
}

export default { getProfile };