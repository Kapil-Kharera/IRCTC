
import type { Request, Response } from "express";
import { ScheduleStatus } from "@prisma/client";

import asyncHandler from "../utils/asyncHandler.js";
import { BadRequestError } from "../utils/error.js";
import scheduleService from "../services/schedule.service.js";

interface CreateScheduleBody {
  trainId: string;
  departureDate: string;
}

interface ScheduleParams {
  scheduleId: string;
}

interface GetAllSchedulesQuery {
  trainId?: string;
  status?: string;
  date?: string;
}

export const createSchedule = asyncHandler(
  async (
    req: Request<{}, {}, CreateScheduleBody>,
    res: Response
  ) => {
    const { trainId, departureDate } = req.body;

    if (!trainId || !departureDate) {
      throw new BadRequestError(
        "trainId and departureDate are required"
      );
    }

    const schedule = await scheduleService.createSchedule({
      trainId,
      departureDate,
    });

    return res.status(201).json({
      success: true,
      message: "Train Schedule created successfully",
      data: schedule,
    });
  }
);

export const cancelSchedule = asyncHandler(
  async (
    req: Request,
    res: Response
  ) => {
    const { scheduleId } = req.params;

    if (!scheduleId) {
      throw new BadRequestError("ScheduleId is missing");
    }

    const schedule = await scheduleService.cancelSchedule(scheduleId as string);

    return res.status(200).json({
      success: true,
      message: "Schedule cancelled",
      data: schedule,
    });
  }
);

export const getAllSchedules = asyncHandler(
  async (
    req: Request<{}, {}, {}, GetAllSchedulesQuery>,
    res: Response
  ) => {
    const { trainId, status, date } = req.query;

    // Validate status against Prisma enum values
    if (
      status &&
      !Object.values(ScheduleStatus).some(
        (validStatus) => validStatus === status
      )
    ) {
      throw new BadRequestError("Invalid schedule status");
    }

    const schedules = await scheduleService.getAllSchedules({
      trainId,
      status: status as ScheduleStatus | undefined,
      date,
    });

    return res.status(200).json({
      success: true,
      data: schedules,
    });
  }
);
