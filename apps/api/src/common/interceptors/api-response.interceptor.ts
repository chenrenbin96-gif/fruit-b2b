import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import type { Response } from 'express';
import { map, type Observable } from 'rxjs';

type ApiEnvelope<T> = {
  code: 'OK';
  message: 'success';
  data: T;
  request_id: string;
  timestamp: string;
};

@Injectable()
export class ApiResponseInterceptor<T>
  implements NestInterceptor<T, ApiEnvelope<T>>
{
  intercept(
    context: ExecutionContext,
    next: CallHandler<T>,
  ): Observable<ApiEnvelope<T>> {
    const response = context.switchToHttp().getResponse<Response>();

    return next.handle().pipe(
      map((data) => ({
        code: 'OK',
        message: 'success',
        data,
        request_id: String(response.locals.requestId ?? ''),
        timestamp: new Date().toISOString(),
      })),
    );
  }
}
