import { KAFKA_TOPICS, withDLQ } from "@irctc/shared";
import { connectProducer, consumer, producer } from "../../config/kafka.js";
import { logger } from "../../config/logger.js";
import { emailService } from "../../services/email.service.js";


class EmailConsumer {
    async start() {
        try {
            await consumer.connect();
            await connectProducer();
            logger.info('Email consumer connected to kafka');

            await consumer.subscribe({
                topics: Object.values(KAFKA_TOPICS),
                fromBeginning: false
            });

            await consumer.run({
                eachMessage: withDLQ(producer, KAFKA_TOPICS.DLQ_NOTIFICATION, logger, async({ topic, parsedValue}: any) => {
                    logger.info(`Processing message from topic: ${topic}`);
                    await this.handleMessage(topic, parsedValue);
                })
            });

            logger.info(`Email consumer is running and listening for messages...`);
        } catch (error: any) {
             logger.error('Failed to start email consumer', { error: error.message });
            throw error;
        }
    }

    async handleMessage(topic: any, data: any) {
        switch(topic) {
            case KAFKA_TOPICS.OTP_EMAIL:
                await this.handleOtpEmail(data);
                break;
            case KAFKA_TOPICS.WELCOME_EMAIL:
                await this.handleWelcomeMail(data);
                break;
            default:
                logger.warn(`Unknown topic : ${topic}`);
        }
    }

    async handleOtpEmail(data: any) {
        const { email, otp, ttlMinutes } = data;

        if(!email || !otp) {
            throw new Error(`Missing required fields : email or otp`);
        }

        await emailService.sendOtpMail(email, otp, ttlMinutes || 5);
        logger.info(`OTP email send to ${email}`);
    }

    async handleWelcomeMail(data: any) {
        const { email, firstName } = data;

        if(!email || !firstName) {
            throw new Error(`Missing required fields : email or firstName`);
        }

        await emailService.sendWelcomeEmail(email, firstName);
        logger.info(`Welcome email sent to ${email}`);
    }

    async stop() {
        await consumer.disconnect();
        logger.info(`Email consumer disconnected`);
    }
}

export const emailConsumer = new EmailConsumer();