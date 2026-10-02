import express, { type RouterOptions } from "express";
import { login, rotateRefreshToken, sendOtp, verifyOtp } from "../controllers/auth.controller";

const router = express.Router();

/**********************SIGNUP**************************************** */
router.post("/send-otp", sendOtp);
router.post("/verify-otp", verifyOtp);

/**********************LOGIN********************************************** */
router.post("/login", login);
router.post("/refresh", rotateRefreshToken);

export default router;