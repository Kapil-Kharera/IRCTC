import { producer, connectProducer } from '../../config/kafka.js';
import logger from '../../config/logger.js';
import { KAFKA_TOPICS } from "@irctc/shared"
import type { Message, RecordMetadata } from 'kafkajs';

class AdminProducer {
    private isInitialized = false;

    async initialize(): Promise<void> {
        if (!this.isInitialized) {
            await connectProducer();
            this.isInitialized = true;
        }
    }

    async sendMessage<T>(
        topic: string,
        key: string | undefined,
        value: T
    ): Promise<RecordMetadata[]> {
        try {
            await this.initialize();

            const message: Message = {
                key: key || `${topic}-${Date.now()}`,
                value: JSON.stringify(value),
                timestamp: Date.now().toString(),
            };

            const result = await producer.send({
                topic,
                messages: [message],
            });

            logger.info(`Message sent to topic: ${topic}`, {
                key: message.key,
                partition: result[0]?.partition,
                offset: result[0]?.offset,
            });

            return result;
        } catch (error: unknown) {
            logger.error(`Failed to send message to topic: ${topic}`, {
                error: error instanceof Error ? error.message : String(error),
                key,
            });

            throw error;
        }
    }

    async publishStationCreated<T extends { id: string | number }>(
        station: T
    ): Promise<RecordMetadata[]> {
        return this.sendMessage(
            KAFKA_TOPICS.STATION_CREATED,
            `station-${station.id}`,
            {
                eventType: 'STATION_CREATED',
                data: station,
                timestamp: new Date().toISOString(),
            }
        );
    }

    async publishTrainCreated<T extends { id: string | number }>(
        trainData: T
    ): Promise<RecordMetadata[]> {
        return this.sendMessage(
            KAFKA_TOPICS.TRAIN_CREATED,
            `train-${trainData.id}`,
            trainData
        );
    }

    async publishRouteCreated<T extends { id: string | number }>(
        routeData: T
    ): Promise<RecordMetadata[]> {
        return this.sendMessage(
            KAFKA_TOPICS.ROUTE_CREATED,
            `route-${routeData.id}`,
            routeData
        );
    }

    async publishScheduleCreated<T extends { scheduleId: string | number }>(
        scheduleData: T
    ): Promise<RecordMetadata[]> {
        return this.sendMessage(
            KAFKA_TOPICS.SCHEDULE_CREATED,
            `schedule-${scheduleData.scheduleId}`,
            scheduleData
        );
    }

    async publishScheduleCancelled<T extends { id: string | number }>(
        schedule: T
    ): Promise<RecordMetadata[]> {
        return this.sendMessage(
            KAFKA_TOPICS.SCHEDULE_CANCELLED,
            `schedule-${schedule.id}`,
            {
                eventType: 'SCHEDULE_CANCELLED',
                data: schedule,
                timestamp: new Date().toISOString(),
            }
        );
    }
}

const adminProducer = new AdminProducer();

export default adminProducer;