import { Kafka, logLevel } from "kafkajs";
import { logger } from "./logger.js";
import { config } from "./index.js";

/**
 * Kafka client create kar rahe hain.
 *
 * clientId: Kafka ko batata hai ki kaunsi application connect ho rahi hai.
 * brokers: Kafka servers ke addresses jahan se connection start hoga.
 * logLevel: KafkaJS ke internal logs mein sirf errors show honge.
 * retry: Connection ya request fail hone par KafkaJS kitni baar retry karega.
 */
const kafka = new Kafka({
    clientId: config.KAFKA_CLIENT_ID,
    brokers: [config.KAFKA_BROKER || "localhost:9093"],
    logLevel: logLevel.ERROR,
    retry: {
        initialRetryTime: 300, // First retry se pehle wait: 300 ms
        retries: 10,           // Maximum retries
        maxRetryTime: 30000,   // Retry delay 30 seconds se zyada nahi
        multiplier: 2,         // Har retry par wait time increase hoga
    },
});

/**
 * Consumer Kafka topics se messages read aur process karta hai.
 *
 * groupId: Consumer group ki identity.
 * Same group ke consumers partitions ko share karke kaam kar sakte hain.
 * Kafka is group ke liye messages ko coordinate karta hai.
 *
 * sessionTimeout: Agar consumer time par heartbeat nahi bhejta,
 * toh Kafka use failed maan sakta hai.
 *
 * heartbeatInterval: Consumer kitne interval par heartbeat bhejega.
 */
const consumer = kafka.consumer({
    groupId: "notification-service-group",
    sessionTimeout: 30000,
    heartbeatInterval: 3000,
});

/**
 * Producer Kafka topics par messages publish karta hai.
 *
 * Is service mein producer ka use DLQ (Dead Letter Queue) mein
 * failed messages bhejne ke liye kiya ja raha hai.
 *
 * allowAutoTopicCreation: Agar publish kiya ja raha topic missing ho,
 * toh Kafka broker configuration allow kare toh use create kar sakta hai.
 *
 * retry: Publish request fail hone par retries configure karta hai.
 */
const producer = kafka.producer({
    allowAutoTopicCreation: true,
    retry: {
        retries: 3,
    },
});

/**
 * Track karta hai ki producer ka connection establish hua hai ya nahi.
 *
 * Producer ko har message ke liye connect karna unnecessary hai.
 * Ek baar connect karke connection reuse kar sakte hain.
 */
let isProducerConnected = false;

/**
 * Producer ko Kafka se connect karta hai.
 *
 * Agar pehle se connected hai, toh dobara connect nahi karega.
 * DLQ message publish karne se pehle producer connected hona chahiye.
 */
const connectProducer = async (): Promise<void> => {
    if (!isProducerConnected) {
        await producer.connect();

        // Flag tabhi update hoga jab connect() successful ho.
        isProducerConnected = true;

        logger.info("Kafka producer connected (DLQ)");
    }
};

/**
 * Graceful shutdown:
 *
 * Application band hone par Kafka connections cleanly close karo.
 *
 * consumer.disconnect(): Consumer ka Kafka connection close karta hai.
 * producer.disconnect(): Producer ka Kafka connection close karta hai.
 *
 * Isse service ko shutdown ke waqt resources release karne ka mauka milta hai.
 */
const shutdown = async (): Promise<void> => {
    logger.info("Shutting down Kafka connections...");

    // Consumer ko disconnect karo.
    await consumer.disconnect();

    // Producer ko tabhi disconnect karo jab connected ho.
    if (isProducerConnected) {
        await producer.disconnect();
        isProducerConnected = false;
    }

    // Process ko exit karne ke liye request karo.
    process.exit(0);
};

// SIGTERM: Docker, Kubernetes ya process manager shutdown signal bhej sakta hai.
// SIGINT: Usually terminal mein Ctrl+C press karne par aata hai.
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);

// In objects ko doosri files mein import karke reuse kar sakte hain.
export { kafka, consumer, producer, connectProducer };