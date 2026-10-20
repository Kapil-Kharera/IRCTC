// import sgMail from "@sendgrid/mail";
// import { logger } from "../config/logger.js";
// import { config } from "../config/index.js";
// import { getOtpTemplate } from "../templates/index.js";
// import { Resend } from "resend";

// console.log("api key : ", config.SENDGRID_API_KEY);
// sgMail.setApiKey(config.SENDGRID_API_KEY);

// type EmailResult =
//     | { success: true }
//     | { success: false; error: string };

// class EmailService {
//     private from: string;
//     private maxRetries: number;
//     private resend: Resend;

//     constructor() {
//         this.from = config.MAIL_SEND;
//         this.maxRetries = 3;
//         this.resend = new Resend(config.RESEND_API_KEY);
//     }

//     async sendWithRetry(message: any, retries: number = 0): Promise<EmailResult> {
//         try {
//             // console.log("api key : ", config.SENDGRID_API_KEY);
//             // await sgMail.send(message);

//             await this.resend.emails.send(message);

//             logger.info(`Email sent successfully to ${message.to}`, {
//                 subject: message.subject,
//                 attempt: retries + 1
//             });

//             return { success: true };
//         } catch (error: any) {
//             console.error("SENDGRID ERROR MESSAGE:", error?.message);
//             console.error("SENDGRID ERROR CODE:", error?.code);
//             console.error("SENDGRID RESPONSE STATUS:", error?.response?.statusCode);
//             console.error(
//                 "SENDGRID RESPONSE BODY:",
//                 JSON.stringify(error?.response?.body, null, 2)
//             );

//             logger.error(
//                 `Email sending failed (attempt ${retries + 1}/${this.maxRetries})`,
//                 {
//                     to: message.to,
//                     error: error?.message,
//                     code: error?.code,
//                     statusCode: error?.response?.statusCode,
//                     responseBody: error?.response?.body,
//                 }
//             );

//             if (retries < this.maxRetries - 1) {
//                 const delay = Math.pow(2, retries) * 1000;
//                 await new Promise((resolve: any) => setTimeout(resolve, delay));
//                 return this.sendWithRetry(message, retries + 1);
//             }

//             return error;
//         }
//     }

//     async sendOtpMail(email: string, otp: string, ttlMinutes: string) {
//         const message = {
//             to: email,
//             from: this.from,
//             subject: 'Your IRCTC verification code',
//             html: getOtpTemplate(otp, ttlMinutes)
//         }

//         return this.sendWithRetry(message);
//     }
// }

// export const emailService = new EmailService();







import { Resend } from "resend";
import { logger } from "../config/logger.js";
import { config } from "../config/index.js";
import { getOtpTemplate, getWelcomeTemplate } from "../templates/index.js";
import { randomUUID } from "node:crypto";

type EmailMessage = {
    to: string;
    from: string;
    subject: string;
    html: string;
};

type EmailResult =
    | { success: true; id?: string }
    | { success: false; error: string };

class EmailService {
    private readonly resend: Resend;
    private readonly from: string;
    private readonly maxAttempts = 3;

    constructor() {
        this.resend = new Resend(config.RESEND_API_KEY);
        this.from = config.MAIL_SEND;
    }

    private sleep(ms: number): Promise<void> {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }

    private isRetryable(statusCode: number | null | undefined): boolean {
        return (
            statusCode === null ||
            statusCode === 429 ||
            (statusCode !== undefined &&
                statusCode >= 500 &&
                statusCode <= 599)
        );
    }

    async sendWithRetry(
        message: EmailMessage
    ): Promise<EmailResult> {
        // Same key for all attempts of this logical email.
        const idempotencyKey = randomUUID();

        for (let attempt = 1; attempt <= this.maxAttempts; attempt++) {
            try {
                const { data, error } = await this.resend.emails.send(
                    message,
                    { idempotencyKey }
                );

                if (!error) {
                    logger.info("Email sent successfully", {
                        to: message.to,
                        subject: message.subject,
                        attempt,
                        emailId: data?.id,
                    });

                    return {
                        success: true,
                        id: data?.id,
                    };
                }

                const retryable = this.isRetryable(error.statusCode);

                logger.error("Email sending failed", {
                    to: message.to,
                    attempt,
                    statusCode: error.statusCode,
                    error: error.message,
                    retryable,
                });

                if (!retryable || attempt === this.maxAttempts) {
                    return {
                        success: false,
                        error: error.message,
                    };
                }
            } catch (error: unknown) {
                const messageText =
                    error instanceof Error
                        ? error.message
                        : "Unknown email sending error";

                logger.error("Email request threw an exception", {
                    to: message.to,
                    attempt,
                    error: messageText,
                });

                // Unknown exceptions may be programming errors.
                // Don't retry them blindly.
                return {
                    success: false,
                    error: messageText,
                };
            }

            // 1s, then 2s before the next attempt.
            await this.sleep(1000 * 2 ** (attempt - 1));
        }

        return {
            success: false,
            error: "Email sending failed after all attempts",
        };
    }

    async sendOtpMail(
        email: string,
        otp: string,
        ttlMinutes: string
    ): Promise<EmailResult> {
        const message: EmailMessage = {
            to: email,
            from: this.from,
            subject: "Your IRCTC verification code",
            html: getOtpTemplate(otp, ttlMinutes),
        };

        return this.sendWithRetry(message);
    }

    async sendWelcomeEmail(email: string, firstName: string): Promise<EmailResult> {
        const msg = {
                to: email,
               from: this.from,
               subject: 'Welcome to DesignKarle - Email Verified',
               html: getWelcomeTemplate(firstName),
        };

        return this.sendWithRetry(msg);
    }
}

export const emailService = new EmailService();
