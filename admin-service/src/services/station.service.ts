import { Prisma } from '@prisma/client';
import prisma from '../config/prisma.js';
import logger from '../config/logger.js';
import adminProducer from '../kafka/producer/admin.producer.js';
import { ConflictError, NotFoundError } from '../utils/error.js';

type CreateStationData = Prisma.StationCreateInput;

interface GetAllStationsResult {
    stations: Prisma.StationGetPayload<object>[];
    total: number;
}

const createStation = async (data: CreateStationData) => {
    const existing = await prisma.station.findUnique({
        where: {
            code: data.code,
        },
    });

    if (existing) {
        throw new ConflictError('Station code already exists');
    }

    const station = await prisma.station.create({ data });

    logger.info('Station Created', {
        id: station.id,
        code: station.code,
    });

    // Publish event - non-critical operation
    await adminProducer.publishStationCreated(station).catch((err: unknown) => {
        logger.error('Failed to publish station created event', {
            error: err instanceof Error ? err.message : String(err),
        });
    });

    return station;
};

const getAllStations = async (
    page: number,
    limit: number,
    search?: string
): Promise<GetAllStationsResult> => {
    const skip = (page - 1) * limit;

    const where: Prisma.StationWhereInput = search
        ? {
              OR: [
                  {
                      code: {
                          contains: search,
                          mode: 'insensitive',
                      },
                  },
                  {
                      name: {
                          contains: search,
                          mode: 'insensitive',
                      },
                  },
                  {
                      city: {
                          contains: search,
                          mode: 'insensitive',
                      },
                  },
              ],
          }
        : {};

    const [stations, total] = await Promise.all([
        prisma.station.findMany({
            where,
            skip,
            take: limit,
            orderBy: {
                name: 'asc',
            },
        }),
        prisma.station.count({ where }),
    ]);

    return { stations, total };
};

const getStationById = async (stationId: string) => {
    const station = await prisma.station.findUnique({
        where: {
            id: stationId,
        },
    });

    if (!station) {
        throw new NotFoundError('Station not found');
    }

    return station;
};

export default {
    createStation,
    getAllStations,
    getStationById,
};