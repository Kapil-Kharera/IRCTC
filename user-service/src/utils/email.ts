import { config } from "../config/index.js";
import sgMail from "@sendgrid/mail";

sgMail.setApiKey(config.SENDGRID_API_KEY || "");

const OTP_TTL = parseInt(config.OTP_TTL || '300', 10);
const minutes = Math.ceil((OTP_TTL) / 60);

const mailFrom = config.MAIL_SEND;

/**
 * Common email styles
 */
const emailStyles = `
    <style>
        body {
            margin: 0;
            padding: 0;
            background-color: #f4f6f8;
            font-family: Arial, Helvetica, sans-serif;
            color: #1f2937;
        }

        .wrapper {
            width: 100%;
            padding: 40px 16px;
            box-sizing: border-box;
        }

        .container {
            max-width: 560px;
            margin: 0 auto;
            background: #ffffff;
            border-radius: 12px;
            overflow: hidden;
            border: 1px solid #e5e7eb;
        }

        .header {
            background: #dc2626;
            color: #ffffff;
            padding: 24px;
            text-align: center;
        }

        .header h1 {
            margin: 0;
            font-size: 24px;
            font-weight: 700;
        }

        .content {
            padding: 32px 28px;
        }

        .content p {
            font-size: 15px;
            line-height: 1.6;
            margin: 0 0 16px;
        }

        .otp-box {
            margin: 28px 0;
            padding: 20px;
            background: #f9fafb;
            border: 1px dashed #d1d5db;
            border-radius: 10px;
            text-align: center;
        }

        .otp {
            font-size: 36px;
            font-weight: 700;
            letter-spacing: 8px;
            color: #111827;
        }

        .expiry {
            margin-top: 10px;
            color: #6b7280;
            font-size: 13px;
        }

        .security {
            margin-top: 24px;
            padding: 16px;
            background: #fff7ed;
            border-left: 4px solid #f97316;
            border-radius: 6px;
            font-size: 13px;
            line-height: 1.5;
            color: #7c2d12;
        }

        .footer {
            padding: 20px 28px;
            background: #f9fafb;
            border-top: 1px solid #e5e7eb;
            text-align: center;
            color: #6b7280;
            font-size: 12px;
            line-height: 1.5;
        }

        @media only screen and (max-width: 600px) {
            .wrapper {
                padding: 20px 10px;
            }

            .content {
                padding: 24px 20px;
            }

            .otp {
                font-size: 30px;
                letter-spacing: 6px;
            }
        }
    </style>
`;

/**
 * Send OTP email
 */
export async function sendOtpMail(
    otp: number | string,
    email: string
): Promise<void> {
    const otpValue = String(otp);

    const html = `
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8" />
            <meta name="viewport" content="width=device-width, initial-scale=1.0" />
            <title>Your IRCTC OTP</title>
            ${emailStyles}
        </head>

        <body>
            <div class="wrapper">
                <div class="container">

                    <div class="header">
                        <h1>IRCTC</h1>
                    </div>

                    <div class="content">
                        <p>Hello,</p>

                        <p>
                            We received a request to verify your email address.
                            Use the One-Time Password (OTP) below to continue.
                        </p>

                        <div class="otp-box">
                            <div class="otp">${otpValue}</div>

                            <div class="expiry">
                                This OTP is valid for ${minutes} minute${minutes !== 1 ? "s" : ""}.
                            </div>
                        </div>

                        <div class="security">
                            <strong>Security notice:</strong>
                            Never share this OTP with anyone. Our team will never
                            ask you for your OTP, password, or other authentication
                            credentials.
                        </div>

                        <p style="margin-top: 24px;">
                            If you did not request this OTP, you can safely ignore
                            this email.
                        </p>

                        <p>
                            Regards,<br />
                            <strong>IRCTC Team</strong>
                        </p>
                    </div>

                    <div class="footer">
                        This is an automated email. Please do not reply to this message.
                        <br />
                        © ${new Date().getFullYear()} IRCTC. All rights reserved.
                    </div>

                </div>
            </div>
        </body>
        </html>
    `;

    const text = `
IRCTC - Email Verification

Hello,

Your OTP is: ${otpValue}

This OTP is valid for ${minutes} minute${minutes !== 1 ? "s" : ""}.

Never share this OTP with anyone. Our team will never ask you for your OTP.

If you did not request this OTP, you can safely ignore this email.

Regards,
IRCTC Team
    `.trim();

    try {
        await sgMail.send({
            to: email,
            from: mailFrom,
            subject: "Your IRCTC verification code",
            text,
            html,
        });
    } catch (error: any) {
        console.log(
            "SENDGRID ERROR:",
            JSON.stringify(error.response?.body, null, 2)
        );

        throw error;
    }
}


/**
 * Send OTP verification-success email
 *
 * This email should be sent AFTER the OTP has
 * been successfully verified.
 */
export async function verifyOtpMail(
    email: string
): Promise<void> {
    const html = `
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8" />
            <meta name="viewport" content="width=device-width, initial-scale=1.0" />
            <title>IRCTC Email Verified</title>
            ${emailStyles}
        </head>

        <body>
            <div class="wrapper">
                <div class="container">

                    <div class="header">
                        <h1>IRCTC</h1>
                    </div>

                    <div class="content">
                        <p>Hello,</p>

                        <p>
                            Your email address has been successfully verified.
                        </p>

                        <div class="otp-box">
                            <div style="
                                font-size: 22px;
                                font-weight: 700;
                                color: #16a34a;
                            ">
                                ✓ Verification Successful
                            </div>

                            <div class="expiry">
                                Your email verification is now complete.
                            </div>
                        </div>

                        <p>
                            You can now continue using your IRCTC account.
                        </p>

                        <div class="security">
                            <strong>Didn't perform this action?</strong>
                            If you did not verify your email, please secure your
                            account immediately and contact support.
                        </div>

                        <p style="margin-top: 24px;">
                            Regards,<br />
                            <strong>IRCTC Team</strong>
                        </p>
                    </div>

                    <div class="footer">
                        This is an automated email. Please do not reply to this message.
                        <br />
                        © ${new Date().getFullYear()} IRCTC. All rights reserved.
                    </div>

                </div>
            </div>
        </body>
        </html>
    `;

    const text = `
IRCTC - Email Verification Successful

Hello,

Your email address has been successfully verified.

You can now continue using your IRCTC account.

If you did not perform this action, please secure your account and contact support.

Regards,
IRCTC Team
    `.trim();

    try {
        await sgMail.send({
            to: email,
            from: mailFrom,
            subject: "Your IRCTC email has been verified",
            text,
            html,
        });
    } catch (error: any) {
        console.log(
            "VERIFY SENDGRID ERROR:",
            JSON.stringify(error.response?.body, null, 2)
        );

        throw error;
    }
}
