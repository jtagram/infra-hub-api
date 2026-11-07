import { describe, expect, it } from '@jest/globals';
import { OpenAPIObject } from '@nestjs/swagger';
import { documentErrorEnvelope, ERROR_RESPONSE_SCHEMA_NAME } from '../setup-swagger';

const buildDocument = (): OpenAPIObject => ({
	openapi: '3.0.0',
	info: { title: 't', version: '1' },
	paths: {
		'/a': {
			get: {
				responses: {
					'200': { description: 'ok' },
					'400': { description: 'bad' },
					'502': { description: 'gateway', content: { 'text/plain': {} } },
				},
			},
		},
	},
});

const responsesOf = (document: OpenAPIObject) =>
	(document.paths['/a'].get as unknown as { responses: Record<string, object> }).responses;

describe('documentErrorEnvelope', () => {
	it('registers the error envelope schema with ok, msg and data', () => {
		const document = documentErrorEnvelope(buildDocument());

		expect(document.components?.schemas?.[ERROR_RESPONSE_SCHEMA_NAME]).toMatchObject({
			required: ['ok', 'msg', 'data'],
		});
	});

	it('points every 4xx/5xx response without a body to the envelope schema', () => {
		const responses = responsesOf(documentErrorEnvelope(buildDocument()));

		expect(responses['400']).toEqual({
			description: 'bad',
			content: {
				'application/json': {
					schema: { $ref: `#/components/schemas/${ERROR_RESPONSE_SCHEMA_NAME}` },
				},
			},
		});
	});

	it('leaves success responses and responses with their own content untouched', () => {
		const responses = responsesOf(documentErrorEnvelope(buildDocument()));

		expect(responses['200']).toEqual({ description: 'ok' });
		expect(responses['502']).toEqual({ description: 'gateway', content: { 'text/plain': {} } });
	});
});
