
import { Router } from "express";

import {
  createTrain,
  createRoute,
  getAllTrains,
  getTrainById,
} from "../controllers/train.controller.js";

import { getUserContext } from "../middlewares/getUserContext.middleware.js";

const router = Router();

router.post(
  "/train",
  getUserContext,
  createTrain
);

router.get(
  "/train",
  getUserContext,
  getAllTrains
);

router.get(
  "/train/:trainId",
  getUserContext,
  getTrainById
);

router.post(
  "/route",
  getUserContext,
  createRoute
);

export default router;
