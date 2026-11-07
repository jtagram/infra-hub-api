import { applyDecorators } from '@nestjs/common';
import {
	ApiBadGatewayResponse,
	ApiBadRequestResponse,
	ApiOperation,
	ApiQuery,
} from '@nestjs/swagger';
import { OperationResult } from '../../../common/dto/operation-result.dto';
import { ApiProtected } from '../../../common/swagger/api-protected.decorator';
import {
	ApiCreatedResponseBody,
	ApiOkResponseBody,
} from '../../../common/swagger/api-response-body.decorator';
import { ListDeploymentsResponse } from '../kubernates-hub-api.dto';

export const ApiListDeployments = () =>
	applyDecorators(
		ApiOperation({
			summary: 'List deployments',
			description:
				'Lists the deployments of a Kubernetes namespace by running `kubectl` through an Ansible playbook on the managed server. Requires the `ADMIN` role in the infra-hub-api application.',
		}),
		ApiProtected(),
		ApiQuery({
			name: 'namespace',
			description: 'Kubernetes namespace whose deployments are listed.',
			example: 'production',
			required: true,
		}),
		ApiOkResponseBody({
			description: 'Deployments found in the namespace.',
			type: ListDeploymentsResponse,
			msg: 'Deployments retrieved successfully',
		}),
		ApiBadRequestResponse({
			description:
				'Invalid query: `namespace` is missing, empty, not a string or longer than 63 characters; unknown query properties are rejected.',
		}),
		ApiBadGatewayResponse({
			description: [
				'The listing failed on the managed server:',
				'- `Failed to list deployments: <detail>`: the playbook failed; `<detail>` is the Ansible failure detail, the stderr or the error message (`unknown error` when none is available).',
				'- `Failed to list deployments`: the playbook succeeded but its output contained no deployment list.',
			].join('\n'),
		}),
	);

export const ApiManageManifest = () =>
	applyDecorators(
		ApiOperation({
			summary: 'Apply, create or delete a manifest',
			description:
				'Runs `kubectl apply|create|delete` with a free-form manifest in a namespace, through an Ansible playbook, and stores an operation log entry. A failed playbook is not an HTTP error: it is reported in `data.executionResult` (`success: false`) inside a successful envelope. Requires the `ADMIN` role in the infra-hub-api application.',
		}),
		ApiProtected(),
		ApiCreatedResponseBody({
			description:
				'Operation executed and logged. `data.executionResult.success` carries the Ansible outcome.',
			type: OperationResult,
			msg: 'Kubernetes manifest operation executed',
		}),
		ApiBadRequestResponse({
			description:
				'Invalid body: `numberOfTickets` is not an integer; `namespace` (max 63 characters) or `manifest` (max 20000 characters) is missing, empty, not a string or too long; `action` is not one of `apply`, `delete`, `create`; unknown properties are rejected.',
		}),
	);

export const ApiExecuteKubectl = () =>
	applyDecorators(
		ApiOperation({
			summary: 'Execute a kubectl command',
			description:
				'Runs a free-form `kubectl` command (arguments only, without the `kubectl` prefix) through an Ansible playbook and stores an operation log entry. The command output is free text in `executionResult.stdout`/`stderr`. A failed command is not an HTTP error: it is reported in `data.executionResult` (`success: false`) inside a successful envelope. Requires the `ADMIN` role in the infra-hub-api application.',
		}),
		ApiProtected(),
		ApiCreatedResponseBody({
			description:
				'Command executed and logged. `data.executionResult.success` carries the outcome.',
			type: OperationResult,
			msg: 'Kubectl command executed',
		}),
		ApiBadRequestResponse({
			description:
				'Invalid body: `numberOfTickets` is not an integer; `kubectlCommand` (max 4000 characters) is missing, empty, not a string or too long; unknown properties are rejected.',
		}),
	);
