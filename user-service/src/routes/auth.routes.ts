import express, { type RouterOptions } from "express";
import { sendOtp, verifyOtp } from "../controllers/auth.controller";

const router = express.Router();

router.post("/send-otp", sendOtp);
router.post("/verify-otp", verifyOtp);

export default router;