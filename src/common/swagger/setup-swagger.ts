import { INestApplication } from '@nestjs/common';
import { DocumentBuilder, OpenAPIObject, SwaggerModule } from '@nestjs/swagger';

export const SWAGGER_PATH = 'docs';

export const ERROR_RESPONSE_SCHEMA_NAME = 'ErrorResponseBody';

const errorResponseSchema = {
	type: 'object' as const,
	required: ['ok', 'msg', 'data'],
	properties: {
		ok: { type: 'boolean', example: false },
		msg: { type: 'string', example: 'You do not have the required role' },
		data: { type: 'object', nullable: true, example: null },
	},
};

/**
 * Documents the error envelope on every 4xx/5xx response that does not
 * declare its own body, so `ok`, `msg` and `data` show up on all error cases.
 */
export function documentErrorEnvelope(document: OpenAPIObject): OpenAPIObject {
	document.components = document.components ?? {};
	document.components.schemas = {
		...document.components.schemas,
		[ERROR_RESPONSE_SCHEMA_NAME]: errorResponseSchema,
	};

	for (const pathItem of Object.values(document.paths)) {
		for (const operation of Object.values(pathItem) as Array<{ responses?: object } | undefined>) {
			if (typeof operation !== 'object' || operation?.responses === undefined) {
				continue;
			}
			for (const [status, response] of Object.entries(
				operation.responses as Record<string, object>,
			)) {
				if (Number(status) < 400 || 'content' in response || '$ref' in response) {
					continue;
				}
				(response as { content?: unknown }).content = {
					'application/json': {
						schema: { $ref: `#/components/schemas/${ERROR_RESPONSE_SCHEMA_NAME}` },
					},
				};
			}
		}
	}

	return document;
}

export function setupSwagger(app: INestApplication): void {
	const config = new DocumentBuilder()
		.setTitle('Infra Hub API')
		.setDescription(
			'Infrastructure operations API: runs Ansible playbooks, kubectl commands and SQL against the managed server.',
		)
		.setVersion('1.0')
		.addBearerAuth()
		.build();

	SwaggerModule.setup(
		SWAGGER_PATH,
		app,
		documentErrorEnvelope(SwaggerModule.createDocument(app, config)),
	);
}
