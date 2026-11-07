import { describe, expect, it } from '@jest/globals';
import { ApiCreatedResponseBody, ApiOkResponseBody } from '../api-response-body.decorator';

// Metadata key under which @nestjs/swagger stores the declared responses.
const API_RESPONSE_METADATA = 'swagger/apiResponse';

class Payload {}

class Sample {
	@ApiOkResponseBody({ type: Payload, description: 'listed', msg: 'Listed', isArray: true })
	list() {}

	@ApiCreatedResponseBody({ type: Payload, description: 'created', msg: 'Created' })
	create() {}
}

const responsesOf = (method: 'list' | 'create') =>
	Reflect.getMetadata(
		API_RESPONSE_METADATA,
		Object.getOwnPropertyDescriptor(Sample.prototype, method)!.value as object,
	) as Record<
		string,
		{ description: string; schema: { required: string[]; properties: Record<string, unknown> } }
	>;

describe('ApiResponseBody decorators', () => {
	it('documents a 200 envelope whose data is an array of the type', () => {
		const response = responsesOf('list')['200'];

		expect(response.description).toBe('listed');
		expect(response.schema.required).toEqual(['ok', 'msg', 'data']);
		expect(response.schema.properties).toMatchObject({
			ok: { type: 'boolean', example: true },
			msg: { type: 'string', example: 'Listed' },
			data: { type: 'array', items: { $ref: '#/components/schemas/Payload' } },
		});
	});

	it('documents a 201 envelope whose data is the type', () => {
		const response = responsesOf('create')['201'];

		expect(response.schema.properties).toMatchObject({
			msg: { example: 'Created' },
			data: { $ref: '#/components/schemas/Payload' },
		});
	});
});
