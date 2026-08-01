import {
  ArgumentsHost,
  Catch,
  HttpException,
  HttpStatus,
  type ExceptionFilter,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { QueryFailedError } from 'typeorm';

type ExceptionBody = {
  code?: string;
  message?: string | string[];
  details?: Record<string, unknown>;
};

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(ApiExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const request = host.switchToHttp().getRequest<Request>();
    const response = host.switchToHttp().getResponse<Response>();
    const databaseError = this.databaseError(exception);
    const status =
      databaseError?.status ??
      (exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR);
    const raw =
      exception instanceof HttpException ? exception.getResponse() : undefined;
    const body = typeof raw === 'object' && raw !== null ? raw : {};
    const exceptionBody = body as ExceptionBody;
    const rawMessage =
      exceptionBody.message ??
      (typeof raw === 'string' ? raw : 'Internal server error');
    const message =
      databaseError?.message ??
      (Array.isArray(rawMessage) ? rawMessage.join('; ') : rawMessage);
    const logContext = {
      event: status >= 500 ? 'api_exception' : 'business_request_rejected',
      request_id: String(response.locals.requestId ?? ''),
      method: request.method,
      path: request.originalUrl.split('?')[0],
      status,
      error_code: databaseError?.code ?? exceptionBody.code ?? 'REQUEST_FAILED',
      exception_type:
        exception instanceof Error ? exception.constructor.name : typeof exception,
    };
    if (status >= 500) {
      this.logger.error(logContext, exception instanceof Error ? exception.stack : message);
    } else if (status !== 401 && status !== 404) {
      this.logger.warn(logContext);
    }

    response.status(status).json({
      code:
        databaseError?.code ??
        exceptionBody.code ??
        (status === HttpStatus.INTERNAL_SERVER_ERROR
          ? 'INTERNAL_SERVER_ERROR'
          : 'REQUEST_FAILED'),
      message,
      details: exceptionBody.details,
      request_id: String(response.locals.requestId ?? ''),
      timestamp: new Date().toISOString(),
    });
  }

  private databaseError(
    exception: unknown,
  ): { status: number; code: string; message: string } | null {
    if (!(exception instanceof QueryFailedError)) return null;
    const driverError = exception.driverError as { errno?: number };
    if (driverError.errno === 1062) {
      return {
        status: HttpStatus.CONFLICT,
        code: 'RESOURCE_ALREADY_EXISTS',
        message: '相同编码或名称的数据已存在',
      };
    }
    if (driverError.errno === 1451 || driverError.errno === 1452) {
      return {
        status: HttpStatus.CONFLICT,
        code: 'RESOURCE_RELATION_CONFLICT',
        message: '关联数据不存在或当前数据仍被使用',
      };
    }
    return null;
  }
}
