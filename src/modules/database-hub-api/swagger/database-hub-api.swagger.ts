import { applyDecorators } from '@nestjs/common';
import {
  ApiBadGatewayResponse,
  ApiBadRequestResponse,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
} from '@nestjs/swagger';
import { OperationResult } from '../../../common/dto/operation-result.dto';
import { ApiProtected } from '../../../common/swagger/api-protected.decorator';
import { ListDatabasesResponse } from '../database-hub-api.dto';

export const ApiListDatabases = () =>
  applyDecorators(
    ApiOperation({
      summary: 'List databases',
      description:
        'Lists the databases of a Postgres deployment by running an Ansible playbook against the managed server. Requires the `ADMIN` role in the infra-hub-api application.',
    }),
    ApiProtected(),
    ApiQuery({
      name: 'namespace',
      description: 'Kubernetes namespace of the Postgres deployment.',
      example: 'production',
      required: true,
    }),
    ApiQuery({
      name: 'deployment',
      description: 'Name of the Postgres deployment.',
      example: 'postgres',
      required: true,
    }),
    ApiOkResponse({
      description: 'Databases found in the deployment.',
      type: ListDatabasesResponse,
    }),
    ApiBadRequestResponse({
      description:
        'Invalid query: `namespace` or `deployment` is missing, empty, not a string or longer than 63 characters; unknown query properties are rejected.',
    }),
    ApiBadGatewayResponse({
      description: [
        'The listing failed on the managed server:',
        '- `Failed to list databases: <detail>`: the playbook failed; `<detail>` is the Ansible failure detail, the stderr or the error message (`unknown error` when none is available).',
        '- `Failed to list databases`: the playbook succeeded but its output contained no database list.',
      ].join('\n'),
    }),
  );

export const ApiManageDatabase = () =>
  applyDecorators(
    ApiOperation({
      summary: 'Run SQL in a database',
      description:
        'Executes the given SQL code in a database of a Postgres deployment through an Ansible playbook and stores an operation log entry. A failed playbook is not an HTTP error: it is reported in `executionResult` (`success: false`). Requires the `ADMIN` role in the infra-hub-api application.',
    }),
    ApiProtected(),
    ApiCreatedResponse({
      description:
        'Operation executed and logged. Check `executionResult.success` for the Ansible outcome.',
      type: OperationResult,
    }),
    ApiBadRequestResponse({
      description:
        'Invalid body: `numberOfTickets` is not an integer; `namespace`, `deployment`, `dbName` (max 63 characters) or `sqlCode` (max 5000 characters) is missing, empty, not a string or too long; unknown properties are rejected.',
    }),
  );

export const ApiCreateDatabase = () =>
  applyDecorators(
    ApiOperation({
      summary: 'Create a database',
      description:
        'Creates a database in a Postgres deployment through an Ansible playbook and stores an operation log entry. A failed playbook is not an HTTP error: it is reported in `executionResult` (`success: false`). Requires the `ADMIN` role in the infra-hub-api application.',
    }),
    ApiProtected(),
    ApiCreatedResponse({
      description:
        'Operation executed and logged. Check `executionResult.success` for the Ansible outcome.',
      type: OperationResult,
    }),
    ApiBadRequestResponse({
      description: [
        'Invalid body:',
        '- `numberOfTickets` is not an integer.',
        '- `namespace`, `deployment` or `dbName` (max 63 characters) is missing, empty, not a string or too long.',
        '- `dbName must be a valid lowercase Postgres identifier`: `dbName` does not use only lowercase letters, digits and underscores, or starts with a digit.',
        '- Unknown properties are rejected.',
      ].join('\n'),
    }),
  );
