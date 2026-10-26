
import axios, {
    type AxiosRequestConfig,
    type AxiosResponse,
    type Method,
    type RawAxiosRequestHeaders,
} from "axios";

import type {
    Request,
    Response,
    NextFunction,
    RequestHandler,
} from "express";

import { config } from "../config/index.js";
import {
    ServiceUnavailableError,
    GatewayTimeoutError,
} from "../utils/error.js";
import { logger } from "../config/logger.js";

/**
 * Circuit Breaker types
 */
type CircuitState = "CLOSED" | "OPEN" | "HALF_OPEN";

interface CircuitBreakerStatus {
    service: string;
    state: CircuitState;
    failureCount: number;
    nextAttempt: string | null;
}

/**
 * Downstream response returned by forwardRequest.
 */
interface ForwardedResponse {
    status: number;
    data: unknown;
    headers: AxiosResponse["headers"];
}

/**
 * Circuit Breaker implementation
 * Prevents cascading failures when downstream services are down.
 */
class CircuitBreaker {
    public readonly serviceName: string;

    private failureCount: number = 0;
    private readonly threshold: number;
    private readonly timeout: number;
    private state: CircuitState = "CLOSED";
    private nextAttempt: number = Date.now();
    private halfOpenRequestInProgress: boolean = false;

    constructor(
        serviceName: string,
        threshold: number = config.CIRCUIT_BREAKER_THRESHOLD,
        timeout: number = config.CIRCUIT_BREAKER_TIMEOUT
    ) {
        if (!Number.isInteger(threshold) || threshold < 1) {
            throw new RangeError(
                "Circuit breaker threshold must be a positive integer"
            );
        }

        if (!Number.isFinite(timeout) || timeout < 0) {
            throw new RangeError(
                "Circuit breaker timeout must be a non-negative number"
            );
        }

        this.serviceName = serviceName;
        this.threshold = threshold;
        this.timeout = timeout;
    }

    public async execute<T>(
        request: () => Promise<T>
    ): Promise<T> {
        if (this.state === "OPEN") {
            if (Date.now() < this.nextAttempt) {
                throw new ServiceUnavailableError(
                    `Service ${this.serviceName} is temporarily unavailable. Circuit breaker is OPEN.`
                );
            }

            this.state = "HALF_OPEN";

            logger.info(
                `Circuit breaker HALF_OPEN for ${this.serviceName}`
            );
        }

        if (this.state === "HALF_OPEN") {
            if (this.halfOpenRequestInProgress) {
                throw new ServiceUnavailableError(
                    `Service ${this.serviceName} is temporarily unavailable. A trial request is already in progress.`
                );
            }

            this.halfOpenRequestInProgress = true;
        }

        try {
            const response: T = await request();

            this.onSuccess();

            return response;
        } catch (error: unknown) {
            this.onFailure();
            throw error;
        } finally {
            this.halfOpenRequestInProgress = false;
        }
    }

    private onSuccess(): void {
        this.failureCount = 0;

        if (this.state === "HALF_OPEN") {
            this.state = "CLOSED";

            logger.info(
                `Circuit breaker CLOSED for ${this.serviceName}`
            );
        }
    }

    private onFailure(): void {
        this.failureCount++;

        if (
            this.state === "HALF_OPEN" ||
            this.failureCount >= this.threshold
        ) {
            this.state = "OPEN";
            this.nextAttempt = Date.now() + this.timeout;

            logger.error(
                `Circuit breaker OPEN for ${this.serviceName}. ` +
                `Next attempt at ${new Date(this.nextAttempt).toISOString()}`
            );
        }
    }

    public getState(): CircuitBreakerStatus {
        return {
            service: this.serviceName,
            state: this.state,
            failureCount: this.failureCount,
            nextAttempt:
                this.state === "OPEN"
                    ? new Date(this.nextAttempt).toISOString()
                    : null,
        };
    }
}

/**
 * Circuit breakers for each service.
 */
const circuitBreakers = {
    userService: new CircuitBreaker("user-service"),
    searchService: new CircuitBreaker("search-service"),
    adminService: new CircuitBreaker("admin-service"),
    notificationService: new CircuitBreaker("notification-service"),
    bookingService: new CircuitBreaker("booking-service"),
    paymentService: new CircuitBreaker("payment-service"),
    inventoryService: new CircuitBreaker("inventory-service"),
};

type ServiceName = keyof typeof circuitBreakers;

/**
 * Forward request to downstream service.
 */
async function forwardRequest(
    serviceUrl: string,
    path: string,
    method: Method,
    data: unknown,
    headers: Request["headers"],
    circuitBreaker: CircuitBreaker
): Promise<ForwardedResponse> {
    const url = `${serviceUrl}${path}`;

    logger.info(url);

    const requestHeaders: RawAxiosRequestHeaders = {
        ...headers,
        host: undefined,
        "content-length": undefined,
    };

    const requestConfig: AxiosRequestConfig = {
        method,
        url,
        timeout: config.SERVICE_TIMEOUT_MS,
        headers: requestHeaders,
        validateStatus: () => true,
        maxRedirects: 5,
    };

    if (
        method !== "GET" &&
        method !== "DELETE" &&
        data !== undefined &&
        data !== null
    ) {
        requestConfig.data = data;
    }

    if (
        (method === "GET" || method === "DELETE") &&
        data !== undefined &&
        data !== null
    ) {
        requestConfig.params = data;
    }

    logger.debug(`Forwarding ${method} ${url}`, {
        headers: requestConfig.headers,
        hasData: data !== undefined && data !== null,
        timeout: config.SERVICE_TIMEOUT_MS,
    });

    try {
        const response = await circuitBreaker.execute<AxiosResponse<unknown>>(() => axios.request<unknown>(requestConfig));

        logger.debug(`Response from ${url}:`, {
            status: response.status,
            statusText: response.statusText,
        });

        return {
            status: response.status,
            data: response.data,
            headers: response.headers,
        };
    } catch (error: unknown) {
        const err = axios.isAxiosError(error) ? error : undefined;

        logger.error(`Error forwarding to ${serviceUrl}:`, {
            message:
                error instanceof Error
                    ? error.message
                    : "Unknown error",
            code: err?.code,
            url,
            method,
            timeout: config.SERVICE_TIMEOUT_MS,
        });

        if (
            err?.code === "ECONNABORTED" ||
            err?.code === "ETIMEDOUT"
        ) {
            throw new GatewayTimeoutError(
                `Request to ${serviceUrl} timed out after ${config.SERVICE_TIMEOUT_MS}ms`
            );
        }

        if (err?.code === "ECONNREFUSED") {
            throw new ServiceUnavailableError(
                `Cannot connect to ${serviceUrl}. Service may be down.`
            );
        }

        if (err?.response) {
            logger.error(`Service error from ${serviceUrl}:`, {
                status: err.response.status,
                data: err.response.data,
            });

            return {
                status: err.response.status,
                data: err.response.data,
                headers: err.response.headers,
            };
        }

        const message =
            error instanceof Error
                ? error.message
                : "Unknown network error";

        logger.error(
            `Network error while calling ${serviceUrl}:`,
            message
        );

        throw new ServiceUnavailableError(
            `Service temporarily unavailable: ${message}`
        );
    }
}

/**
 * Proxy middleware factory.
 */
function createProxy(
    serviceName: ServiceName,
    serviceUrl: string
): RequestHandler {
    const circuitBreaker = circuitBreakers[serviceName];

    return async (
        req: Request,
        res: Response,
        next: NextFunction
    ): Promise<void> => {
        try {
            logger.info(req.path);

            const pathParts = req.path.split("/").filter(Boolean);

            logger.info(pathParts);

            const servicePath = "/" + pathParts.slice(1).join("/");

            logger.info(servicePath);

            const queryIndex = req.url.indexOf("?");

            const queryString = queryIndex !== -1 ? req.url.substring(queryIndex) : "";

            const result = await forwardRequest(
                serviceUrl,
                servicePath + queryString,
                req.method as Method,
                req.body as unknown,
                req.headers,
                circuitBreaker
            );

            const excludeHeaders = [
                "connection",
                "keep-alive",
                "transfer-encoding",
                "host",
            ];

            Object.entries(result.headers).forEach(
                ([key, value]) => {
                    if (
                        !excludeHeaders.includes(key.toLowerCase()) &&
                        value !== undefined
                    ) {
                        res.setHeader(key, value);
                    }
                }
            );

            res.status(result.status).json(result.data);
        } catch (error: unknown) {
            next(error);
        }
    };
}

/**
 * Health check endpoint for circuit breakers.
 */
function getCircuitBreakerStatus(): CircuitBreakerStatus[] {
    return Object.values(circuitBreakers).map(
        (circuitBreaker) => circuitBreaker.getState()
    );
}

export {
    CircuitBreaker,
    circuitBreakers,
    createProxy,
    getCircuitBreakerStatus,
};

export type {
    CircuitState,
    CircuitBreakerStatus,
    ForwardedResponse,
    ServiceName,
};
