import { applyDecorators } from '@nestjs/common';
import { ApiOkResponse, ApiOperation } from '@nestjs/swagger';

export const ApiGetHealth = () =>
  applyDecorators(
    ApiOperation({
      summary: 'Check the service health',
      description:
        'Public endpoint (no authentication). Verifies that the API is up and can reach its database.',
    }),
    ApiOkResponse({ description: 'The service is healthy.' }),
  );
