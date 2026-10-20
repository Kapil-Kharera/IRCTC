// /**
//  * Dead-Letter Queue (DLQ) handler for kafka consumers.
//  * 
//  * Wraps eachMessage processing with retry tracking. After DLQ_MAX_RETRIES
//  * consecutive failures the message is forwarded to a per-service DLQ topic
//  * and the consumer moves on instead of blocking forever.
//  * 
//  * Usage (in any consumer):
//  * const { withDLQ } from "@irctc/shared";
//  * await consumer.run({ eachMessage: withDLQ(producer, dlqTopic, logger, handler)});
//  * 
//  */

// import { DLQ_MAX_RETRIES } from "../constants/kafka-topics.js";

// /**
//  * @param {import('kafkajs').Producer} producer  – Kafka producer (for sending to DLQ)
//  * @param {string}  dlqTopic   – DLQ topic name (e.g. KAFKA_TOPICS.DLQ_BOOKING)
//  * @param {object}  logger     – Winston logger
//  * @param {Function} handler   – async ({ topic, partition, message, parsedValue }) => void
//  * @returns {Function} eachMessage-compatible handler
//  */

// function withDLQ(producer: any, dlqTopic: any, logger: any, handler: any) {
//     //In-memory retry tracker: key = `${topic}:${partition}:${offset}` -> attempt count
//     const retryMap = new Map();

//     return async ({ topic, partition, message }: any) => {
//         const msgKey = `${topic}:${partition}:${message.offset}`;
//         const attempt = (retryMap.get(msgKey) || 0) + 1;
//         retryMap.set(msgKey, attempt);

//         let parsedValue;
//         try {
//             parsedValue = JSON.parse(message.value.toString());
//         } catch (parseErr: any) {
//             //completely unparseable - send to DLQ immediately
//             logger.error(`Unparseable message on ${topic}, sending to DLQ`, {
//                 partition,
//                 offset: message.offset,
//                 error: parseErr.message
//             });

//             await sendToDLQ(producer, dlqTopic, topic, partition, message, parseErr, logger);
//             retryMap.delete(msgKey);
//             return;
//         }

//         try {
//             await handler({ topic, partition, message, parsedValue });
//             //success - clean up
//             retryMap.delete(msgKey);
//         } catch (error: any) {
//             logger.error(`Error processing ${topic} (attempt ${attempt}/${DLQ_MAX_RETRIES})`, {
//                 error: error.message,
//                 partition,
//                 offset: message.offset
//             });

//             if (attempt >= DLQ_MAX_RETRIES) {
//                 logger.error(`Max retries exceeded for ${topic}, sending to DLQ`, {
//                     partition,
//                     offset: message.offset
//                 });

//                 await sendToDLQ(producer, dlqTopic, topic, partition, message, error, logger);
//                 retryMap.delete(msgKey);
//             } else {
//                 //re-throw so kafkajs, retries(it will re-deliver the same message)
//                 throw error;
//             }
//         }
//     }
// }

// async function sendToDLQ(producer: any, dlqTopic: any, originalTopic: any, partition: any, message: any, error: any, logger: any) {
//     try {
//         await producer.send({
//             topic: dlqTopic,
//             message: [{
//                 key: message.key,
//                 value: message.value,
//                 headers: {
//                     ...message.headers,
//                     'dlq-original-topic': originalTopic,
//                     'dlq-original-partition': String(partition),
//                     'dlq-original-offset': message.offset,
//                     'dlq-error': error.message,
//                     'dlq-timestamp': new Date().toISOString()
//                 }
//             }]
//         });

//         logger.info(`Message sent to DLQ : ${dlqTopic}`, { originalTopic, partition, offset: message.offset });
//     } catch (dlqError: any) {
//         // If even the DLQ publish fails, log and move on — don't block the consumer forever
//         logger.error(`Failed to send message to DLQ ${dlqTopic}`, {
//             error: dlqError.message,
//             originalTopic,
//             partition,
//             offset: message.offset,
//         });
//     }
// }


// export { withDLQ };





/**
 * Dead Letter Queue (DLQ) Handler for Kafka Consumers
 *
 * Simple meaning:
 * Agar Kafka se aaya hua message process nahi ho paata,
 * toh hum usko kuch baar retry karte hain.
 *
 * Agar baar-baar fail hota hai, toh message ko DLQ topic
 * mein bhej dete hain, taaki baaki messages process ho sakein.
 *
 * DLQ = Dead Letter Queue
 * Ye ek alag Kafka topic hota hai jahan failed messages
 * debugging aur baad mein reprocessing ke liye store hote hain.
 *
 * Usage:
 *
 * await consumer.run({
 *   eachMessage: withDLQ(
 *     producer,
 *     dlqTopic,
 *     logger,
 *     handler
 *   )
 * });
 */

import { DLQ_MAX_RETRIES } from "../constants/kafka-topics.js";

/**
 * withDLQ() kya karta hai?
 *
 * Ye normal message handler ke around ek protective layer banata hai.
 * Is layer ki responsibility hai:
 *
 * 1. Message ko JSON mein parse karna.
 * 2. Handler ko message process karne dena.
 * 3. Failure hone par retry count track karna.
 * 4. Maximum retries ke baad message DLQ mein bhejna.
 *
 * @param producer
 * Kafka producer jo DLQ topic mein message publish karega.
 *
 * @param dlqTopic
 * DLQ topic ka naam, jaise DLQ_BOOKING.
 *
 * @param logger
 * Winston logger, jisse info, warning aur error logs likhenge.
 *
 * @param handler
 * Tumhara actual business logic, jaise booking process karna.
 */
function withDLQ(
    producer: any,
    dlqTopic: any,
    logger: any,
    handler: any
) {
    /**
     * Map ek temporary in-memory storage hai.
     *
     * Key ka format:
     * "topic:partition:offset"
     *
     * Value:
     * Is message ko kitni baar process karne ki koshish hui.
     *
     * Example:
     * "booking-events:0:125" => 2
     *
     * Matlab partition 0 ke offset 125 wale message ki
     * processing 2 attempts tak pahunch chuki hai.
     *
     * Important:
     * Ye data RAM mein hai. Consumer restart hua toh Map reset
     * ho jayega. Ye permanent retry storage nahi hai.
     */
    const retryMap = new Map<string, number>();

    /**
     * KafkaJS har message ke liye is function ko call karta hai.
     *
     * topic     = message kis Kafka topic se aaya
     * partition = topic ka kaunsa partition
     * message   = actual Kafka message
     *
     * Offset message ki position identify karta hai
     * uske partition ke andar.
     */
    return async ({ topic, partition, message }: any) => {

        // Har message ki unique identity banate hain.
        // Isse alag-alag messages ke retry counts mix nahi honge.
        const msgKey = `${topic}:${partition}:${message.offset}`;

        /**
         * Current attempt number nikaalo.
         *
         * Agar Map mein pehle count nahi hai, toh 0 se start karo.
         * Phir 1 add karke current attempt save kar do.
         *
         * Example:
         * First attempt  = 1
         * Second attempt = 2
         * Third attempt  = 3
         */
        const attempt = (retryMap.get(msgKey) || 0) + 1;
        retryMap.set(msgKey, attempt);

        let parsedValue;

        /**
         * Kafka message ka value generally Buffer hota hai.
         *
         * toString() Buffer ko readable string mein convert karta hai.
         * JSON.parse() us string ko JavaScript object mein convert karta hai.
         *
         * Example:
         * '{"bookingId":123}'
         *
         * Convert hoke:
         * { bookingId: 123 }
         */
        try {
            parsedValue = JSON.parse(message.value.toString());

        } catch (parseErr: any) {

            /**
             * Agar JSON invalid hai, toh message parse hi nahi ho sakta.
             *
             * Example:
             * '{"bookingId":'
             *
             * Aise message ko business handler process nahi kar sakta.
             * Isliye is implementation mein invalid JSON ko directly
             * DLQ mein bhejne ki koshish karte hain.
             */
            logger.error(
                `Unparseable message on ${topic}, sending to DLQ`,
                {
                    partition,
                    offset: message.offset,
                    error: parseErr.message
                }
            );

            // Original message aur parsing error DLQ handler ko do.
            // Agar publish fail hua, toh error propagate hona chahiye.
            await sendToDLQ(
                producer,
                dlqTopic,
                topic,
                partition,
                message,
                parseErr,
                logger
            );

            // Successfully DLQ mein bhejne ke baad retry count hata do.
            retryMap.delete(msgKey);

            // Parsing fail ho gayi, isliye business handler run nahi hoga.
            return;
        }

        /**
         * Ab actual business logic run karenge.
         *
         * Example:
         * handler({ topic, partition, message, parsedValue })
         *
         * Is handler ke andar booking save karna, payment process
         * karna ya koi aur business operation ho sakta hai.
         */
        try {
            await handler({
                topic,
                partition,
                message,
                parsedValue
            });

            // Handler successful raha toh retry count ki zaroorat nahi.
            retryMap.delete(msgKey);

        } catch (error: any) {

            /**
             * Business logic fail ho gaya.
             *
             * Example:
             * - Database temporarily unavailable
             * - API call fail ho gayi
             * - Business validation ya processing error
             *
             * Error log karte hain taaki debugging ho sake.
             */
            logger.error(
                `Error processing ${topic} (attempt ${attempt}/${DLQ_MAX_RETRIES})`,
                {
                    error: error.message,
                    partition,
                    offset: message.offset
                }
            );

            /**
             * Check karo ki maximum allowed attempts complete ho gaye
             * ya nahi.
             *
             * Example:
             * DLQ_MAX_RETRIES = 3
             *
             * Attempt 1 -> failure, retry ki permission
             * Attempt 2 -> failure, retry ki permission
             * Attempt 3 -> failure, DLQ mein bhejo
             */
            if (attempt >= DLQ_MAX_RETRIES) {

                logger.error(
                    `Max retries exceeded for ${topic}, sending to DLQ`,
                    {
                        partition,
                        offset: message.offset
                    }
                );

                // Maximum attempts complete: message ko DLQ mein bhejo.
                await sendToDLQ(
                    producer,
                    dlqTopic,
                    topic,
                    partition,
                    message,
                    error,
                    logger
                );

                // DLQ publish successful hone ke baad retry tracking hatao.
                retryMap.delete(msgKey);

                /**
                 * Yahan error throw nahi kar rahe, kyunki message
                 * DLQ mein safely publish ho chuka hai.
                 *
                 * Lekin Kafka offset commit ka behavior consumer config
                 * aur processing flow par depend karta hai.
                 */

            } else {

                /**
                 * Abhi retries baaki hain.
                 *
                 * Error ko dobara throw karte hain taaki KafkaJS ko
                 * failure pata chale.
                 *
                 * IMPORTANT:
                 * Error throw karna apne aap exactly utni baar retry
                 * karne ki guarantee nahi deta jitna DLQ_MAX_RETRIES hai.
                 * KafkaJS mein eachMessage failures aur consumer restart
                 * behavior ko bhi configure karna padta hai.
                 */
                throw error;
            }
        }
    };
}

/**
 * sendToDLQ() ka kaam:
 *
 * Failed message ko original topic se DLQ topic mein publish karna.
 *
 * Hum original message ka key, value aur headers preserve karte hain,
 * aur debugging ke liye additional DLQ headers add karte hain.
 */
async function sendToDLQ(
    producer: any,
    dlqTopic: any,
    originalTopic: any,
    partition: any,
    message: any,
    error: any,
    logger: any
) {
    try {

        /**
         * Kafka producer ka send() method messages ko topic par publish
         * karta hai.
         *
         * IMPORTANT:
         * KafkaJS mein property ka naam "messages" hai, "message" nahi.
         *
         * Key:
         * Related messages ko same partition mein route karne mein help
         * kar sakti hai.
         *
         * Value:
         * Original message ka payload hai.
         *
         * Headers:
         * Message ke saath additional metadata bhejne ke liye hain.
         */
        await producer.send({
            topic: dlqTopic,

            messages: [
                {
                    key: message.key,
                    value: message.value,

                    headers: {
                        // Original headers ko preserve karo.
                        ...message.headers,

                        // Ye metadata batata hai ki message kahan se aaya.
                        "dlq-original-topic": originalTopic,
                        "dlq-original-partition": String(partition),
                        "dlq-original-offset": String(message.offset),

                        // Failure ka reason debugging ke liye store karo.
                        "dlq-error": String(error?.message ?? error),

                        // Message DLQ mein bhejne ka timestamp.
                        "dlq-timestamp": new Date().toISOString()
                    }
                }
            ]
        });

        // Kafka producer ne publish successful report kiya.
        logger.info(`Message sent to DLQ: ${dlqTopic}`, {
            originalTopic,
            partition,
            offset: message.offset
        });

    } catch (dlqError: any) {

        /**
         * DLQ publish bhi fail ho gaya.
         *
         * Example:
         * - DLQ topic unavailable hai.
         * - Kafka broker unreachable hai.
         * - Producer error aa gaya.
         *
         * Sirf log karke return karna risky hai, kyunki caller samajh
         * sakta hai ki message safely DLQ mein chala gaya.
         *
         * Isliye error ko dobara throw karte hain, taaki caller failure
         * ko handle kar sake aur message silently lose na ho.
         */
        logger.error(`Failed to send message to DLQ ${dlqTopic}`, {
            error: dlqError.message,
            originalTopic,
            partition,
            offset: message.offset
        });

        throw dlqError;
    }
}

// Taaki doosri files is function ko import kar sakein.
export { withDLQ };



/**
 * 
 * 
 => Kafka ka flow ek example se samjho
Maan lo tumhara consumer booking-events topic se booking messages read kar raha hai.

Message receive hota hai. KafkaJS eachMessage ko call karta hai.

JSON parse hota hai. Message string/Buffer se JavaScript object banta hai.

Business handler run hota hai. Maan lo database temporarily down hai aur booking save nahi hui.

Retry attempt count badhta hai. Tumhare code mein har delivery par attempt increment hota hai.

Maximum attempts par DLQ publish hota hai. Failed message aur error metadata DLQ_BOOKING jaise topic mein bheje jaate hain.
 
*/