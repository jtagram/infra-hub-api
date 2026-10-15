import { describe, expect, it } from '@jest/globals';
import { GENERIC_ERROR_MESSAGE } from '../generic-error-message';

describe('GENERIC_ERROR_MESSAGE', () => {
	it('is a client-safe message that exposes no internal details', () => {
		expect(GENERIC_ERROR_MESSAGE).toBe('An unexpected error occurred. Please try again later.');
	});
});
