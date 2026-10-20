import { Kafka, logLevel, type KafkaConfig } from "kafkajs";
import { logger } from "./logger";
import { config } from "./index";

const kafka = new Kafka({
    clientId: config.KAFKA_CLIENT_ID,
    brokers: [ config.KAFKA_BROKER || "localhost:9093"],
    logLevel: logLevel.ERROR,
    retry: {
        initialRetryTime: 300,
        retries: 8,
        maxRetryTime: 30000
    }
});

const producer = kafka.producer({
    allowAutoTopicCreation: true, //true only for development, not for production
    transactionTimeout: 30000,
    idempotent: true, //ensure exactly one delivery
    maxInFlightRequests: 5,
    retry: {
        retries: 5
    }
});

let isConnected = false;

const connectProducer = async () => {
    if(!isConnected) {
        await producer.connect();
        isConnected = true;
        logger.info("Kafka producer connected");
    }
}

const disconnectProducer = async () => {
    if(isConnected) {
        await producer.disconnect()
        isConnected = false;
        logger.info("Kafka producer disconnected");
    }
}

//Graceful shutdowns
process.on("SIGTERM", disconnectProducer);
process.on("SIGINT", disconnectProducer);

export { kafka, producer, connectProducer, disconnectProducer };