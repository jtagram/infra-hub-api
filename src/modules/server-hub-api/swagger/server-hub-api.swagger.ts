import { applyDecorators } from '@nestjs/common';
import {
	ApiBadRequestResponse,
	ApiInternalServerErrorResponse,
	ApiOperation,
} from '@nestjs/swagger';
import { OperationResult } from '../../../common/dto/operation-result.dto';
import { ApiProtected } from '../../../common/swagger/api-protected.decorator';
import { ApiCreatedResponseBody } from '../../../common/swagger/api-response-body.decorator';

export const ApiManageServer = () =>
	applyDecorators(
		ApiOperation({
			summary: 'Run an Ansible playbook on the server',
			description:
				'Executes the given Ansible playbook against the managed server and stores an operation log entry. A failed playbook is not an HTTP error: it is reported in `data.executionResult` (`success: false`) inside a successful envelope. Requires the `ADMIN` role in the infra-hub-api application.',
		}),
		ApiProtected(),
		ApiCreatedResponseBody({
			description:
				'Playbook executed and logged. `data.executionResult.success` carries the Ansible outcome.',
			type: OperationResult,
			msg: 'Server playbook executed',
		}),
		ApiBadRequestResponse({
			description:
				'Invalid body: `numberOfTickets` is not an integer; `playbook` (max 20000 characters) is missing, empty, not a string or too long; unknown properties are rejected.',
		}),
		ApiInternalServerErrorResponse({
			description: [
				'The playbook was rejected before running (the error is not mapped, so the response is the generic error envelope with the generic 5xx message):',
				'- `Invalid YAML playbook: <detail>`: the text is not valid YAML.',
				'- `Invalid Ansible playbook: expected a YAML list of plays`: the YAML is valid but not a list of plays.',
			].join('\n'),
		}),
	);
