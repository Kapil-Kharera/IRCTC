

const KAFKA_TOPICS = {
     // Notification topics (user-service -> notification-service)
     OTP_EMAIL: 'notification.otp-email',
     WELCOME_EMAIL: 'notification.welcome-email',

     // Dead-letter queues (per service — poison messages land here)
     DLQ_NOTIFICATION: 'dlq.notification-service',
}

const DLQ_MAX_RETRIES = 3;

export { KAFKA_TOPICS, DLQ_MAX_RETRIES };