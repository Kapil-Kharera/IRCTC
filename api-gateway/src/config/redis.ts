import { Redis } from "ioredis";
import type { Redis as RedisType } from "ioredis";
import { config } from "./index.js";
import { logger } from "./logger.js";

export class RedisClient {
    static instance: RedisType | undefined;
    static isConnected: boolean = false;

     constructor() {
          // prevent direct instantiation
     }

     static getInstance() {
          if (!RedisClient.instance) {
               RedisClient.instance = new Redis(config.REDIS_URL, {
                    retryStrategy: (times: number) => {
                         const delay = Math.min(times * 50, 2000);
                         return delay;
                    },
                    maxRetriesPerRequest: 3
               })

               RedisClient.setupEventListeners();
          }

          return RedisClient.instance;
     }

     static setupEventListeners() {
          RedisClient.instance?.on('connect', () => {
               RedisClient.isConnected = true;
               logger.info("Connected to Redis");
          })

          RedisClient.instance?.on('error', (error) => {
               RedisClient.isConnected = false;
               logger.error("Redis connection error", error);
          })

          RedisClient.instance?.on('close', () => {
               RedisClient.isConnected = false;
               logger.warn("Redis connection closed");
          })

          RedisClient.instance?.on('reconnecting', () => {
               logger.warn("Reconnecting to Redis...");
          })

          RedisClient.instance?.on('ready', () => {
               logger.warn("Redis client is ready");
          })

          RedisClient.instance?.on('end', () => {
               RedisClient.isConnected = false;
               logger.warn("Redis connection ended");
          })
     }

     static async closeConnection() {
          if (RedisClient.instance) {
               try {
                    await RedisClient.instance.quit();
                    logger.info("Redis connection closed");
               } catch (error) {
                    logger.error("Error closing Redis connection: ", error);
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
               logger.error("Redis connection test failed: ", error);
               return false;
          }
     }
}

// Export both the singleton instance and the class
export const redis = RedisClient.getInstance();