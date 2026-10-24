import type { Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import type { AuthRequest } from "../middlewares/auth.middleware";
import { BadRequestError } from "../utils/error";
import userService from "../services/user.service";


const getProfile = asyncHandler(async (req: Request, res: Response) => {
    
    const userId = req.user?.id;

    if(!userId) {
        throw new BadRequestError("User is not authenticated");
    }

    const user = await userService.getProfile(userId);

    return res.status(200).json({
        success: true,
        message: "Fetched user details",
        data: {
            user
        }
    });

});

export { getProfile };