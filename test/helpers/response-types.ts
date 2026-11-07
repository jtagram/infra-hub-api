/** Error envelope produced by the global exception filters: `{ ok: false, msg, data: null }`. */
export interface ErrorBody {
	ok: false;
	msg: string;
	data: null;
}

/** Success envelope: `{ ok: true, msg, data }`. */
export interface SuccessBody<T> {
	ok: true;
	msg: string;
	data: T;
}

/**
 * supertest types `response.body` as `any`; this pins it to the shape the test
 * expects (the assertions in the test verify the actual values).
 */
export function bodyOf<T>(res: { body: unknown }): T {
	return res.body as T;
}

/** The `data` payload of a success envelope. */
export function dataOf<T>(res: { body: unknown }): T {
	return bodyOf<SuccessBody<T>>(res).data;
}

/**
 * ValidationPipe failures are joined with ', ' into `msg` by the HTTP filter.
 * Splits them back, only at the start of the next class-validator message
 * (`<property> must|should ...` or `property <x> should not exist`) so that
 * enum messages such as "one of the following values: a, b, c" stay intact.
 */
export function messagesOf(res: { body: unknown }): string[] {
	return bodyOf<ErrorBody>(res).msg.split(/, (?=\w+ (?:must|should)\b|property )/);
}
