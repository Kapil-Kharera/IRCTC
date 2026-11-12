
import type { Request, Response } from "express";

import asyncHandler from "../utils/asyncHandler.js";
import { BadRequestError } from "../utils/error.js";
import trainService from "../services/train.service.js";

interface SeatInput {
  seatNumber: string;
  seatType: string;
  price: number;
}

interface CreateTrainBody {
  trainNumber: string;
  trainName: string;
  coachName: string;
  seats: SeatInput[];
}

interface RouteStationInput {
  stationId: string;
  sequenceNumber: number;
  arrivalTime?: string | null;
  departureTime?: string | null;
  distanceFromOrigin?: number;
}

interface CreateRouteBody {
  trainId: string;
  stations: RouteStationInput[];
}

interface TrainParams {
  trainId: string;
}

export const createTrain = asyncHandler(
  async (
    req: Request<{}, {}, CreateTrainBody>,
    res: Response
  ) => {
    const { trainNumber, trainName, coachName, seats } = req.body;

    if (!trainNumber || !trainName || !coachName || !seats) {
      throw new BadRequestError(
        "trainNumber, trainName, coachName, and seats are required"
      );
    }

    if (!Array.isArray(seats) || seats.length === 0) {
      throw new BadRequestError(
        "At least one seat must be defined"
      );
    }

    const train = await trainService.createTrain({
      trainNumber,
      trainName,
      coachName,
      seats,
    });

    return res.status(201).json({
      success: true,
      message: "Train added successfully",
      data: train,
    });
  }
);

export const createRoute = asyncHandler(
  async (
    req: Request<{}, {}, CreateRouteBody>,
    res: Response
  ) => {
    const { trainId, stations } = req.body;

    if (!trainId || !stations) {
      throw new BadRequestError(
        "Train ID and stations are required"
      );
    }

    if (!Array.isArray(stations) || stations.length < 2) {
      throw new BadRequestError(
        "A route must have at least 2 stations (origin and destination)"
      );
    }

    const route = await trainService.createRoute({
      trainId,
      stations,
    });

    return res.status(201).json({
      success: true,
      message: "Route created",
      data: route,
    });
  }
);

export const getAllTrains = asyncHandler(
  async (_req: Request, res: Response) => {
    const trains = await trainService.getAllTrains();

    return res.status(200).json({
      success: true,
      data: trains,
    });
  }
);

export const getTrainById = asyncHandler(
  async (
    req: Request,
    res: Response
  ) => {
    const { trainId } = req.params;

    if (!trainId) {
      throw new BadRequestError("Train ID is missing");
    }

    const train = await trainService.getTrainById(trainId as string);

    return res.status(200).json({
      success: true,
      data: train,
    });
  }
);
