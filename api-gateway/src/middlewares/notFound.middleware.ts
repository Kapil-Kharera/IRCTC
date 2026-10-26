import type { NextFunction, Request, Response } from "express";

import { NotFoundError } from "../utils/error.js";

export function notFound(req:Request, res: Response, next: NextFunction) {
  next(new NotFoundError(`Route ${req.method} ${req.path} not found`));
}
