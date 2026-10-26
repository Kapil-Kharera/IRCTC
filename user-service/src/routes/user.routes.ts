import express from "express";
import { getProfile } from "../controllers/user.controller";
import { getUserContext } from "../middlewares/getUserContext.middleware";

const router = express.Router();

router.get("/profile", getUserContext, getProfile);


export default router;