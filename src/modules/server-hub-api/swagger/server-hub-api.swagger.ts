import { applyDecorators } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiCreatedResponse,
  ApiInternalServerErrorResponse,
  ApiOperation,
} from '@nestjs/swagger';
import { OperationResult } from '../../../common/dto/operation-result.dto';
import { ApiProtected } from '../../../common/swagger/api-protected.decorator';

export const ApiManageServer = () =>
  applyDecorators(
    ApiOperation({
      summary: 'Run an Ansible playbook on the server',
      description:
        'Executes the given Ansible playbook against the managed server and stores an operation log entry. A failed playbook is not an HTTP error: it is reported in `executionResult` (`success: false`). Requires the `ADMIN` role in the infra-hub-api application.',
    }),
    ApiProtected(),
    ApiCreatedResponse({
      description:
        'Playbook executed and logged. Check `executionResult.success` for the Ansible outcome.',
      type: OperationResult,
    }),
    ApiBadRequestResponse({
      description:
        'Invalid body: `numberOfTickets` is not an integer; `playbook` (max 20000 characters) is missing, empty, not a string or too long; unknown properties are rejected.',
    }),
    ApiInternalServerErrorResponse({
      description: [
        'The playbook was rejected before running (the error is not mapped, so the response body is the generic Nest `Internal Server Error`):',
        '- `Invalid YAML playbook: <detail>`: the text is not valid YAML.',
        '- `Invalid Ansible playbook: expected a YAML list of plays`: the YAML is valid but not a list of plays.',
      ].join('\n'),
    }),
  );
