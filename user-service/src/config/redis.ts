import { Redis } from "ioredis";
import type { Redis as RedisType } from "ioredis";
import { config } from "./index.js";
import { logger } from "./logger.js";

//singleton pattern - create one connection only.
export class RedisClient {
    static instance: RedisType | undefined;
    static isConnected: boolean = false;

    constructor() { }; //prevent direct instantiation

    static getInstance() {
        if (!RedisClient.instance) {
            RedisClient.instance = new Redis(config.REDIS_URL, {
                retryStrategy: (times: number) => {
                    const delay = Math.min(times * 50, 2000);
                    return delay;
                },
                maxRetriesPerRequest: 3
            });

            RedisClient.setupEventListeners();
        }

        return RedisClient.instance;
    }

    static setupEventListeners() {
        RedisClient.instance?.on("connect", () => {
            RedisClient.isConnected = true;
            logger.info("Connected to redis");
        });

        RedisClient.instance?.on("error", (error: Error) => {
            RedisClient.isConnected = false;
            logger.error("Redis connection error", error);
        });

        RedisClient.instance?.on("close", () => {
            RedisClient.isConnected = false;
            logger.warn("Redis connection closed");
        });

        RedisClient.instance?.on("reconnecting", () => {
            logger.warn("Reconnecting to redis...");
        });

        RedisClient.instance?.on("ready", () => {
            logger.warn("Redis client is ready");
        });

        RedisClient.instance?.on("end", () => {
            RedisClient.isConnected = false;
            logger.warn("Redis connection ended");
        })
    }

    static async closeConnection() {
        if (RedisClient.instance) {
            try {
                await RedisClient.instance.quit();
                logger.info("Redis connection is closed");
            } catch (error) {
                logger.error("Error is closing redis connection : ", error);
            }
        }
    }

    static isReady() {
        return RedisClient.isConnected;
    }

    static async testConnection() {
        try {
            await RedisClient.instance?.ping();
            return true;
        } catch (error) {
            logger.error("Error in the redis test connection : ", error);
            return false;
        }
    }
}

export const redis = RedisClient.getInstance();