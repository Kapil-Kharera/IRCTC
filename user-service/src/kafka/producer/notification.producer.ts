import { producer, connectProducer } from "../../config/kafka";
import { logger } from "../../config/logger";
import { KAFKA_TOPICS } from "@irctc/shared";


class NotificationProducer {
    private isInitialized: boolean = false;

    constructor() {
        this.isInitialized = false;
    }

    async initilize() {
        if(!this.isInitialized) {
            await connectProducer();
            this.isInitialized = true;
        }
    }

    async sendMessage(topic: string, key: string, value: any) {
        try {
            await this.initilize();

            const message = {
                topic,
                messages: [{
                    key: key || `${topic}-${Date.now()}`,
                    value: JSON.stringify(value),
                    timeStamp: Date.now().toString()
                }]
            }

            const result = await producer.send(message);
            logger.info(`Message send to kafka topic : ${topic}`, {
                key,
                partition: result[0]?.partition,
                offset: result[0]?.offset
            });

            return result;
        } catch (error: any) {
            logger.error(`Failed to send message to kafka topic : ${topic}`, {
                error: error.message,
                stack: error.stack,
                key
            });

            throw error;
        }
    }

    async sendOtpMail(email: string, otp: string, ttlInMinutes: number | string = 5) {
        return this.sendMessage(
            KAFKA_TOPICS.OTP_EMAIL,
            `otp:${email}`,
            { email, otp, ttlInMinutes }
        )
    } 
    
    async sendWelcomeEmail(email: string, firstName: string) {
        return this.sendMessage(
            KAFKA_TOPICS.WELCOME_EMAIL,
            `welcome-${email}`,
            {email, firstName}
        )
    }
}

export const notificationProducer = new NotificationProducer();