import type {
    NextFunction,
    Request,
    RequestHandler,
    Response,
} from "express";

type AsyncController<Req extends Request> = (req: Req, res: Response, next: NextFunction) => Promise<unknown> | unknown;

export const asyncHandler = <Req extends Request = Request>(fn: AsyncController<Req>): RequestHandler => {
    return (req: Request, res: Response, next: NextFunction) => {
        Promise.resolve(fn(req as Req, res, next)).catch(next);
    };
};
