import { applyDecorators } from '@nestjs/common';
import { ApiOkResponse, ApiOperation } from '@nestjs/swagger';

export const ApiGetHello = () =>
	applyDecorators(
		ApiOperation({
			summary: 'Health greeting',
			description:
				'Public endpoint that returns a plain-text greeting. It requires no authentication.',
		}),
		ApiOkResponse({
			description: 'Plain-text greeting.',
			schema: { type: 'string', example: 'Hello World!' },
		}),
	);
