
import prisma from "../config/prisma.js";
import {
  BadRequestError,
  ConflictError,
  NotFoundError,
} from "../utils/error.js";

import adminProducer from "../kafka/producer/admin.producer.js";
import logger from "../config/logger.js";

import type { Prisma } from "@prisma/client";

interface SeatInput {
  seatNumber: string;
  seatType: string;
  price: number;
}

interface CreateTrainInput {
  trainNumber: string;
  trainName: string;
  coachName?: string;
  seats: SeatInput[];
}

interface RouteStationInput {
  stationId: string;
  sequenceNumber: number;
  arrivalTime?: string | null;
  departureTime?: string | null;
  distanceFromOrigin?: number;
}

interface CreateRouteInput {
  trainId: string;
  stations: RouteStationInput[];
}

const createTrain = async (data: CreateTrainInput) => {
  const { trainNumber, trainName, coachName, seats } = data;

  const existing = await prisma.train.findUnique({
    where: { trainNumber },
  });

  if (existing) {
    throw new ConflictError(
      "Train with this number already exists"
    );
  }

  if (!Array.isArray(seats) || seats.length === 0) {
    throw new BadRequestError(
      "At least one seat must be defined"
    );
  }

  const seatNumbers = seats.map((seat) => seat.seatNumber);

  if (new Set(seatNumbers).size !== seatNumbers.length) {
    throw new BadRequestError("Duplicate seat numbers found");
  }

  const train = await prisma.train.create({
    data: {
      trainNumber,
      trainName,
      coachName: coachName || "AC",
      totalSeats: seats.length,
      seats: {
        create: seats.map((seat) => ({
          seatNumber: seat.seatNumber,
          seatType: seat.seatType,
          price: seat.price,
        })),
      },
    },
    include: {
      seats: {
        orderBy: { seatNumber: "asc" },
      },
    },
  });

  await adminProducer.publishTrainCreated(train).catch((err: unknown) => {
    logger.error("Failed to publish train created event", {
      error: err instanceof Error ? err.message : String(err),
    });
  });

  return train;
};

const createRoute = async (data: CreateRouteInput) => {
  const { trainId, stations } = data;

  const train = await prisma.train.findUnique({
    where: { id: trainId },
  });

  if (!train) {
    throw new NotFoundError("Train not found");
  }

  const existingRoute = await prisma.route.findUnique({
    where: { trainId },
  });

  if (existingRoute) {
    throw new ConflictError(
      "Route already exists for this train"
    );
  }

  if (!Array.isArray(stations) || stations.length < 2) {
    throw new BadRequestError(
      "A route must have at least 2 stations"
    );
  }

  const stationIds = stations.map((station) => station.stationId);

  if (new Set(stationIds).size !== stationIds.length) {
    throw new BadRequestError(
      "Duplicate stations are not allowed in a route"
    );
  }

  const existingStations = await prisma.station.findMany({
    where: {
      id: { in: stationIds },
    },
  });

  if (existingStations.length !== stationIds.length) {
    throw new BadRequestError(
      "One or more station IDs are invalid"
    );
  }

  const sorted = [...stations].sort(
    (a, b) => a.sequenceNumber - b.sequenceNumber
  );

  for (let i = 0; i < sorted.length; i++) {
    if (sorted[i].sequenceNumber !== i + 1) {
      throw new BadRequestError(
        "Sequence numbers must be continuous starting from 1"
      );
    }
  }

  const route = await prisma.route.create({
    data: {
      trainId,
      routeStations: {
        create: stations.map((station) => ({
          stationId: station.stationId,
          sequenceNumber: station.sequenceNumber,
          arrivalTime: station.arrivalTime
            ? new Date(station.arrivalTime)
            : null,
          departureTime: station.departureTime
            ? new Date(station.departureTime)
            : null,
          distanceFromOrigin: station.distanceFromOrigin ?? 0,
        })),
      },
    },
    include: {
      routeStations: {
        include: { station: true },
        orderBy: { sequenceNumber: "asc" },
      },
    },
  });

  const trainWithSeats = await prisma.train.findUnique({
    where: { id: trainId },
    include: {
      seats: {
        orderBy: { seatNumber: "asc" },
      },
    },
  });

  await adminProducer.publishRouteCreated({
    ...route,
    train: trainWithSeats,
  });

  return route;
};

const getAllTrains = async () => {
  return prisma.train.findMany({
    include: {
      seats: {
        orderBy: { seatNumber: "asc" },
      },
      route: {
        include: {
          routeStations: {
            include: { station: true },
            orderBy: { sequenceNumber: "asc" },
          },
        },
      },
    },
    orderBy: { trainNumber: "asc" },
  });
};

const getTrainById = async (id: string) => {
  const train = await prisma.train.findUnique({
    where: { id },
    include: {
      seats: {
        orderBy: { seatNumber: "asc" },
      },
      route: {
        include: {
          routeStations: {
            include: { station: true },
            orderBy: { sequenceNumber: "asc" },
          },
        },
      },
    },
  });

  if (!train) {
    throw new NotFoundError("Train not found");
  }

  return train;
};

export default {
  createTrain,
  createRoute,
  getAllTrains,
  getTrainById,
};

