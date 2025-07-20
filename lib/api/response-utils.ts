import { NextResponse } from 'next/server';

// Standardized response types
export interface ApiSuccessResponse<T = undefined> {
  status: 'success';
  data?: T;
}

export interface ApiErrorResponse {
  status: 'error';
  error: string;
}

export type ApiResponse<T = undefined> = ApiSuccessResponse<T> | ApiErrorResponse;

// Helper functions for creating standardized responses
export function createSuccessResponse<T = undefined>(
  data?: T,
  httpStatus: number = 200
): NextResponse {
  const response: ApiSuccessResponse<T> = {
    status: 'success',
    ...(data !== undefined && { data })
  };
  return NextResponse.json(response, { status: httpStatus });
}

export function createErrorResponse(
  error: string,
  httpStatus: number = 400
): NextResponse {
  const response: ApiErrorResponse = {
    status: 'error',
    error
  };
  return NextResponse.json(response, { status: httpStatus });
}

// Common error responses
export const commonErrors = {
  invalidJson: () => createErrorResponse('Invalid JSON', 400),
  invalidInput: (message: string = 'Invalid input') => createErrorResponse(message, 400),
  unauthorized: () => createErrorResponse('Unauthorized', 401),
  forbidden: () => createErrorResponse('Forbidden', 403),
  notFound: () => createErrorResponse('Not found', 404),
  tooManyRequests: (message: string = 'Too many requests') => createErrorResponse(message, 429),
  internalError: (message: string = 'Internal server error') => createErrorResponse(message, 500)
};

// Legacy response format helpers (for backwards compatibility during migration)
export function createLegacySuccessResponse(
  data?: Record<string, unknown>,
  httpStatus: number = 200
): NextResponse {
  return NextResponse.json(data || { status: 'ok' }, { status: httpStatus });
}

export function createLegacyErrorResponse(
  error: string,
  httpStatus: number = 400
): NextResponse {
  return NextResponse.json({ error }, { status: httpStatus });
}