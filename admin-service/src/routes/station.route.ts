import { Router } from "express";
import { getUserContext } from "../middlewares/getUserContext.middleware.js";
import { internalAuth } from "../middlewares/internalAuth.middleware.js";
import { createStation, getAllStations, getStationById, getStationByIdInternal } from "../controllers/station.controller.js";

const router = Router();

router.get(
  "/station/internal/:stationId",
  internalAuth,
  getStationByIdInternal
);

router.get(
  "/station",
  getUserContext,
  getAllStations
);

router.get(
  "/station/:stationId",
  getUserContext,
  getStationById
);

router.post(
  "/station",
  getUserContext,
  createStation
);

export default router;
