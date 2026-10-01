import { prisma } from "../config/prisma"
import { sendOtpMail, verifyOtpMail } from "../utils/email";
import { BadRequestError, ConflictError } from "../utils/error";
import bcrypt from "bcrypt";
import { generateAndStoreOtp, verifyOtpAndSessionId } from "../utils/otp";



const sendOTP = async (firstName: string, lastName: string, email: string, password: string) => {
    const isUserExisted = await prisma.user.findUnique({
        where: { email }
    });

    if(isUserExisted) {
        throw new ConflictError("User is already existed");
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    const meta = { firstName, lastName, email, hashedPassword };

    const { otp, otpSessionId } = await generateAndStoreOtp(meta);

    await sendOtpMail(otp, email);

    return otpSessionId;
}


const verifyOTP = async (otp: string, otpSessionId: string) => {
      const meta = await verifyOtpAndSessionId(otp, otpSessionId);

      if(meta == null) {
        throw new BadRequestError("Invalid or expired OTP", "OTP_INVALID");
      }

      const user = await prisma.user.create({
        data: {
            firstName: meta.firstName,
            lastName: meta.lastName,
            email: meta.email,
            password: meta.hashedPassword,
            emailVerified: true
        }
      });

      await verifyOtpMail(meta);

      return user;
}

export default { sendOTP, verifyOTP };