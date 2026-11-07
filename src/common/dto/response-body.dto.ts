/**
 * Single envelope wrapping every API response, success or error.
 * Build it only through `ResponseBody.success` / `ResponseBody.failure`
 * so `ok` and `data` can never be inconsistent.
 */
export class ResponseBody<T> {
	private constructor(
		readonly ok: boolean,
		readonly msg: string,
		readonly data: T | null,
	) {}

	static success<T>(msg: string, data: T): ResponseBody<T> {
		return new ResponseBody<T>(true, msg, data);
	}

	static failure(msg: string): ResponseBody<never> {
		return new ResponseBody<never>(false, msg, null);
	}
}
