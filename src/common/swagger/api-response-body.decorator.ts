import { applyDecorators, Type } from '@nestjs/common';
import { ApiCreatedResponse, ApiExtraModels, ApiOkResponse, getSchemaPath } from '@nestjs/swagger';

interface ApiResponseBodyOptions {
	/** Response DTO class carried in `data`. */
	type: Type<unknown>;
	/** `true` when `data` is an array of `type`. */
	isArray?: boolean;
	/** Description of the HTTP status. */
	description: string;
	/** Example of the `msg` field returned by the service. */
	msg: string;
}

const responseBodySchema = ({ type, isArray, msg }: ApiResponseBodyOptions) => ({
	type: 'object' as const,
	required: ['ok', 'msg', 'data'],
	properties: {
		ok: { type: 'boolean', example: true },
		msg: { type: 'string', example: msg },
		data: isArray
			? { type: 'array', items: { $ref: getSchemaPath(type) } }
			: { $ref: getSchemaPath(type) },
	},
});

/** Documents a 200 response wrapped in the generic `ResponseBody<T>` envelope. */
export const ApiOkResponseBody = (options: ApiResponseBodyOptions) =>
	applyDecorators(
		ApiExtraModels(options.type),
		ApiOkResponse({
			description: options.description,
			schema: responseBodySchema(options),
		}),
	);

/** Documents a 201 response wrapped in the generic `ResponseBody<T>` envelope. */
export const ApiCreatedResponseBody = (options: ApiResponseBodyOptions) =>
	applyDecorators(
		ApiExtraModels(options.type),
		ApiCreatedResponse({
			description: options.description,
			schema: responseBodySchema(options),
		}),
	);
