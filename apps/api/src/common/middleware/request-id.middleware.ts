import { randomUUID } from 'node:crypto';

import type { NextFunction, Request, Response } from 'express';

export class RequestIdMiddleware {
  use(request: Request, response: Response, next: NextFunction): void {
    const requestId = request.header('x-request-id') ?? randomUUID();
    response.locals.requestId = requestId;
    response.setHeader('x-request-id', requestId);
    next();
  }
}
