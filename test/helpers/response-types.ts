/** Error body produced by Nest's exception layer / the global filter. */
export interface ErrorBody {
  statusCode: number;
  error?: string;
  /** `string[]` for ValidationPipe failures, `string` otherwise. */
  message: string | string[];
}

/**
 * supertest types `response.body` as `any`; this pins it to the shape the test
 * expects (the assertions in the test verify the actual values).
 */
export function bodyOf<T>(res: { body: unknown }): T {
  return res.body as T;
}
