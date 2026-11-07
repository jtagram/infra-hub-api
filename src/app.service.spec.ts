import { describe, expect, it } from '@jest/globals';
import { AppService } from './app.service';

describe('AppService', () => {
	it('returns the greeting inside a success envelope', () => {
		expect(new AppService().getHello()).toEqual({
			ok: true,
			msg: 'Service is running',
			data: 'Hello World!',
		});
	});
});
