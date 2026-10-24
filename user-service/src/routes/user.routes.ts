import express from "express";
import { requireAuth } from "../middlewares/auth.middleware";
import { getProfile } from "../controllers/user.controller";

const router = express.Router();

router.get("/get-profile", requireAuth, getProfile);


export default router;