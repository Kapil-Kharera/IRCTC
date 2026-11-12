
import { Router } from "express";

import {
  createSchedule,
  cancelSchedule,
  getAllSchedules,
} from "../controllers/schedule.controller.js";

import { getUserContext } from "../middlewares/getUserContext.middleware.js";

const router = Router();

router.post(
  "/schedule",
  getUserContext,
  createSchedule
);

router.put(
  "/schedule/:scheduleId",
  getUserContext,
  cancelSchedule
);

router.get(
  "/schedule",
  getUserContext,
  getAllSchedules
);

export default router;
