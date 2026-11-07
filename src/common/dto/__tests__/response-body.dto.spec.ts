import { describe, expect, it } from '@jest/globals';
import { ResponseBody } from '../response-body.dto';

describe('ResponseBody.success', () => {
	it('builds an ok envelope with msg and data', () => {
		const body = ResponseBody.success('done', { id: 1 });

		expect(body).toBeInstanceOf(ResponseBody);
		expect(body).toEqual({ ok: true, msg: 'done', data: { id: 1 } });
	});

	it('accepts falsy data values such as an empty array', () => {
		expect(ResponseBody.success('empty', []).data).toEqual([]);
	});

	it('accepts an empty message', () => {
		expect(ResponseBody.success('', 0)).toEqual({ ok: true, msg: '', data: 0 });
	});
});

describe('ResponseBody.failure', () => {
	it('builds a not-ok envelope with null data', () => {
		const body = ResponseBody.failure('not found');

		expect(body).toBeInstanceOf(ResponseBody);
		expect(body).toEqual({ ok: false, msg: 'not found', data: null });
	});

	it('serializes with the three envelope keys', () => {
		expect(JSON.parse(JSON.stringify(ResponseBody.failure('boom')))).toEqual({
			ok: false,
			msg: 'boom',
			data: null,
		});
	});
});
