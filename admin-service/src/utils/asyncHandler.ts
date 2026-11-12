// // utils/asyncHandler.ts

// import type {
//     Request,
//     Response,
//     NextFunction,
//     RequestHandler,
// } from 'express';

// const asyncHandler = (
//     fn: (
//         req: Request,
//         res: Response,
//         next: NextFunction
//     ) => Promise<unknown> | unknown
// ): RequestHandler => {
//     return (req, res, next) => {
//         Promise.resolve(fn(req, res, next)).catch(next);
//     };
// };

// export default asyncHandler;



// utils/asyncHandler.ts

import type {
    Request,
    Response,
    NextFunction,
    RequestHandler,
} from 'express';

const asyncHandler = <
    P = Record<string, string>,
    ResBody = unknown,
    ReqBody = unknown,
    ReqQuery = Record<string, unknown>
>(
    fn: (
        req: Request<P, ResBody, ReqBody, ReqQuery>,
        res: Response<ResBody>,
        next: NextFunction
    ) => unknown
): RequestHandler<P, ResBody, ReqBody, ReqQuery> => {
    return (req, res, next) => {
        Promise.resolve(fn(req, res, next)).catch(next);
    };
};

export default asyncHandler;