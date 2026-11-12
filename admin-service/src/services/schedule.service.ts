import {
    BadRequestError,
    ConflictError,
    NotFoundError,
} from "../utils/error.js";

import adminProducer from "../kafka/producer/admin.producer.js";
import logger from "../config/logger.js";
import prisma from "../config/prisma.js";

import type { Prisma } from "@prisma/client";

interface CreateScheduleInput {
    trainId: string;
    departureDate: string;
}

interface GetAllSchedulesQuery {
    trainId?: string;
    status?: Prisma.ScheduleWhereInput["status"];
    date?: string;
}

interface ScheduleCreatedEvent {
    scheduleId: string;
    trainId: string;
    trainNumber: string;
    trainName: string;
    coachName: string;
    totalSeats: number;
    departureDate: string;
    status: string;
    seats: {
        seatId: string;
        seatNumber: string;
        seatType: string;
        price: number;
    }[];
    route: {
        stationId: string;
        stationName: string;
        stationCode: string;
        city: string;
        sequenceNumber: number;
        arrivalTime: Date | null;
        departureTime: Date | null;
        distanceFromOrigin: number;
    }[];
}

const createSchedule = async (
    data: CreateScheduleInput
) => {
    const { trainId, departureDate } = data;

    const train = await prisma.train.findUnique({
        where: { id: trainId },
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

    if (!train.route) {
        throw new BadRequestError(
            "Train has no route defined. Create a route first."
        );
    }

    if (train.seats.length === 0) {
        throw new BadRequestError("Train has no seats defined.");
    }

    const parsedDate = new Date(departureDate);

    if (Number.isNaN(parsedDate.getTime())) {
        throw new BadRequestError(
            "Invalid departure date format. Use YYYY-MM-DD"
        );
    }

    // Check for duplicate schedule
    const existing = await prisma.schedule.findUnique({
        where: {
            trainId_departureDate: {
                trainId,
                departureDate: parsedDate,
            },
        },
    });

    if (existing) {
        throw new ConflictError(
            "Schedule already exists for this train on this date"
        );
    }

    const schedule = await prisma.schedule.create({
        data: {
            trainId,
            departureDate: parsedDate,
        },
    });

    // Build event payload for Kafka consumers
    const eventPayload: ScheduleCreatedEvent = {
        scheduleId: schedule.id,
        trainId: train.id,
        trainNumber: train.trainNumber,
        trainName: train.trainName,
        coachName: train.coachName,
        totalSeats: train.totalSeats,
        departureDate,
        status: schedule.status,

        seats: train.seats.map((seat: any) => ({
            seatId: seat.id,
            seatNumber: seat.seatNumber,
            seatType: seat.seatType,
            price: seat.price,
        })),

        route: train.route.routeStations.map((routeStation: any) => ({
            stationId: routeStation.station.id,
            stationName: routeStation.station.name,
            stationCode: routeStation.station.code,
            city: routeStation.station.city,
            sequenceNumber: routeStation.sequenceNumber,
            arrivalTime: routeStation.arrivalTime,
            departureTime: routeStation.departureTime,
            distanceFromOrigin: routeStation.distanceFromOrigin,
        })),
    };

    // Publish to inventory-service and search-service
    await adminProducer.publishScheduleCreated(eventPayload);

    logger.info(
        `Schedule created and event published for train ${train.trainNumber} on ${departureDate}`
    );

    return schedule;
};

const getAllSchedules = async (
    query: GetAllSchedulesQuery = {}
) => {
    const where: Prisma.ScheduleWhereInput = {};

    if (query.trainId) {
        where.trainId = query.trainId;
    }

    if (query.status) {
        where.status = query.status;
    }

    if (query.date) {
        const parsedDate = new Date(query.date);

        if (Number.isNaN(parsedDate.getTime())) {
            throw new BadRequestError("Invalid date format");
        }

        where.departureDate = parsedDate;
    }

    return prisma.schedule.findMany({
        where,
        include: {
            train: {
                include: {
                    route: {
                        include: {
                            routeStations: {
                                include: { station: true },
                                orderBy: { sequenceNumber: "asc" },
                            },
                        },
                    },
                },
            },
        },
        orderBy: {
            departureDate: "asc",
        },
    });
};

const cancelSchedule = async (scheduleId: string) => {
    const schedule = await prisma.schedule.findUnique({
        where: { id: scheduleId },
    });

    if (!schedule) {
        throw new NotFoundError("Schedule not found");
    }

    const updated = await prisma.schedule.update({
        where: { id: scheduleId },
        data: {
            status: "CANCELLED",
        },
    });

    await adminProducer.publishScheduleCancelled(updated);

    return updated;
};

export default { createSchedule, getAllSchedules, cancelSchedule }