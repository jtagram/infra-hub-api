import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';
import { load } from 'js-yaml';
import {
  InfrastructureDepartment,
  InfrastructureOperationsLogEntity,
} from '../../src/common/database/infrastructure-operatios-log.entity';
import {
  AppTestApp,
  createAppTestApp,
  expectedAnsibleArgs,
  TEST_SSH_PRIVATE_KEY,
} from '../helpers/app-test-app';
import {
  ansibleChangedOutput,
  ansibleFatalOutput,
} from '../helpers/ansible-output';
import {
  ADMIN_AUTHORIZATION,
  authorizationHeaderFor,
  authorizationHeaderForClaims,
  expiredAdminAuthorizationHeader,
  unknownKidAdminAuthorizationHeader,
  wrongKeyAdminAuthorizationHeader,
} from '../helpers/test-auth';

const PSQL_AS_POSTGRES_USER_SCRIPT =
  'if [ -z "$POSTGRES_USER" ]; then ' +
  'echo "POSTGRES_USER is not set in this deployment" >&2; exit 1; fi; ' +
  'exec psql -U "$POSTGRES_USER" "$@"';

const ENDPOINT = '/database-hub-api/create-database';
const NAME_MESSAGE = 'dbName must be a valid lowercase Postgres identifier';

function validBody(overrides: Record<string, unknown> = {}) {
  return {
    numberOfTickets: 42,
    namespace: 'databases',
    deployment: 'postgres',
    dbName: 'orders_db',
    ...overrides,
  };
}

function expectedPlaybook(
  namespace: string,
  deployment: string,
  dbName: string,
) {
  return [
    {
      hosts: 'all',
      gather_facts: false,
      tasks: [
        {
          name: 'Create database',
          'ansible.builtin.command': {
            argv: [
              'microk8s',
              'kubectl',
              'exec',
              `deploy/${deployment}`,
              '-n',
              namespace,
              '--',
              'sh',
              '-c',
              PSQL_AS_POSTGRES_USER_SCRIPT,
              'sh',
              '-d',
              'postgres',
              '-v',
              'ON_ERROR_STOP=1',
              '-c',
              `CREATE DATABASE "${dbName}";`,
            ],
          },
        },
      ],
    },
  ];
}

describe('POST /database-hub-api/create-database (e2e)', () => {
  let testApp: AppTestApp;

  beforeAll(async () => {
    testApp = await createAppTestApp();
  });

  beforeEach(async () => {
    await testApp.resetState();
  });

  afterEach(() => {
    // The stub is the only exec path: nothing may have used node:child_process
    // and every file must have been written (and removed) inside the temp dir.
    testApp.assertNoRealProcess();
    expect(testApp.leftoverTempEntries()).toEqual([]);
  });

  afterAll(async () => {
    await testApp.close();
  });

  function post(
    body: unknown,
    authorization: string | null = ADMIN_AUTHORIZATION,
  ) {
    const req = testApp.http().post(ENDPOINT);
    if (authorization) {
      req.set('Authorization', authorization);
    }
    return req.send(body as object);
  }

  describe('success', () => {
    it('returns 201 with the execution result and the id of the persisted log', async () => {
      const stdout = ansibleChangedOutput('Create database');
      testApp.process.succeedWith(stdout);

      const response = await post(validBody()).expect(201);

      expect(response.body).toEqual({
        executionResult: { success: true, stdout, stderr: '', exitCode: 0 },
        logId: expect.stringMatching(/^[0-9a-f-]{36}$/),
      });
    });

    it('hands ansible-playbook the exact args, timeout, playbook and SSH key', async () => {
      testApp.process.succeedWith(ansibleChangedOutput('Create database'));

      await post(validBody()).expect(201);

      expect(testApp.process.calls).toHaveLength(1);
      const [call] = testApp.process.calls;
      expect(call.command).toBe('ansible-playbook');
      expect(call.args).toEqual(expectedAnsibleArgs(call));
      expect(call.options).toEqual({ timeout: 240000 });
      expect(load(call.playbook)).toEqual(
        expectedPlaybook('databases', 'postgres', 'orders_db'),
      );
      expect(call.sshKey).toBe(TEST_SSH_PRIVATE_KEY);
      expect(call.sshKeyMode).toBe(0o600);
    });

    it('persists one DATABASE operations log row whose instruction is the CREATE DATABASE statement', async () => {
      testApp.process.succeedWith(ansibleChangedOutput('Create database'));

      const response = await post(validBody()).expect(201);

      const rows = await testApp.logRows();
      expect(rows).toHaveLength(1);
      expect(rows[0].id).toBe(response.body.logId);
      expect(rows[0].department).toBe(InfrastructureDepartment.DATABASE);
      expect(rows[0].numberOfTicket).toBe(42);
      expect(rows[0].instruction).toBe('CREATE DATABASE "orders_db";');
      expect(JSON.parse(rows[0].response)).toEqual(
        response.body.executionResult,
      );
    });

    it('accepts a name starting with an underscore and one of exactly 63 characters', async () => {
      testApp.process.succeedWith(ansibleChangedOutput('Create database'));

      await post(validBody({ dbName: '_' + 'a'.repeat(62) })).expect(201);

      expect(testApp.process.calls).toHaveLength(1);
    });
  });

  describe('process layer failures', () => {
    it('returns 201 with success false and logs it when the database already exists', async () => {
      const stdout = ansibleFatalOutput('Create database', {
        stderr: 'ERROR:  database "orders_db" already exists',
      });
      testApp.process.failWith({ code: 2, stdout });

      const response = await post(validBody()).expect(201);

      expect(response.body.executionResult).toEqual({
        success: false,
        stdout,
        stderr: '',
        exitCode: 2,
        errorMessage: 'Command failed: ansible-playbook',
        errorCode: 2,
      });
      const rows = await testApp.logRows();
      expect(rows).toHaveLength(1);
      expect(rows[0].id).toBe(response.body.logId);
      expect(JSON.parse(rows[0].response)).toEqual(
        response.body.executionResult,
      );
    });

    it('documents current behavior: a non-ExecFileError from the exec layer becomes a 500 and nothing is logged', async () => {
      testApp.process.throwWith(new Error('spawn ansible-playbook ENOENT'));

      const response = await post(validBody()).expect(500);

      expect(response.body).toEqual({
        statusCode: 500,
        message: 'Internal server error',
      });
      expect(testApp.process.calls).toHaveLength(1);
      expect(await testApp.logRows()).toEqual([]);
    });
  });

  describe('database failure after execution', () => {
    it('documents current behavior: when saving the log fails the operation already ran, the caller gets 500 and no row exists', async () => {
      testApp.process.succeedWith(ansibleChangedOutput('Create database'));
      const repository = testApp.dataSource.getRepository(
        InfrastructureOperationsLogEntity,
      );
      const saveSpy = jest
        .spyOn(repository, 'save')
        .mockRejectedValueOnce(new Error('connection terminated unexpectedly'));

      try {
        const response = await post(validBody()).expect(500);

        expect(response.body).toEqual({
          statusCode: 500,
          message: 'Internal server error',
        });
        expect(saveSpy).toHaveBeenCalledTimes(1);
        // The side effect has already happened on the target host.
        expect(testApp.process.calls).toHaveLength(1);
        expect(await testApp.logRows()).toEqual([]);
      } finally {
        saveSpy.mockRestore();
      }
    });
  });

  describe('validation', () => {
    it('returns 400 when the body is empty', async () => {
      const response = await post({}).expect(400);

      expect(response.body.message).toEqual(
        expect.arrayContaining([
          'numberOfTickets must be an integer number',
          'namespace must be a string',
          'deployment must be a string',
          'dbName must be a string',
          NAME_MESSAGE,
        ]),
      );
      expect(testApp.process.calls).toEqual([]);
    });

    it('returns 400 when namespace is missing', async () => {
      const { namespace, ...body } = validBody();
      expect(namespace).toBeDefined();

      const response = await post(body).expect(400);

      expect(response.body.message).toEqual(
        expect.arrayContaining(['namespace must be a string']),
      );
    });

    it('returns 400 when deployment is missing', async () => {
      const { deployment, ...body } = validBody();
      expect(deployment).toBeDefined();

      const response = await post(body).expect(400);

      expect(response.body.message).toEqual(
        expect.arrayContaining(['deployment must be a string']),
      );
    });

    it('returns 400 when namespace or deployment are empty', async () => {
      const response = await post(
        validBody({ namespace: '', deployment: '' }),
      ).expect(400);

      expect(response.body.message).toEqual([
        'namespace should not be empty',
        'deployment should not be empty',
      ]);
    });

    it('returns 400 when namespace or deployment exceed 63 characters', async () => {
      const response = await post(
        validBody({ namespace: 'a'.repeat(64), deployment: 'b'.repeat(64) }),
      ).expect(400);

      expect(response.body.message).toEqual([
        'namespace must be shorter than or equal to 63 characters',
        'deployment must be shorter than or equal to 63 characters',
      ]);
    });

    it('returns 400 when dbName is missing', async () => {
      const { dbName, ...body } = validBody();
      expect(dbName).toBeDefined();

      const response = await post(body).expect(400);

      expect(response.body.message).toEqual(
        expect.arrayContaining(['dbName must be a string', NAME_MESSAGE]),
      );
    });

    it('returns 400 when dbName is empty', async () => {
      const response = await post(validBody({ dbName: '' })).expect(400);

      expect(response.body.message).toEqual(
        expect.arrayContaining(['dbName should not be empty', NAME_MESSAGE]),
      );
    });

    it('returns 400 when dbName is not a string', async () => {
      const response = await post(validBody({ dbName: 123 })).expect(400);

      expect(response.body.message).toEqual(
        expect.arrayContaining(['dbName must be a string']),
      );
    });

    it('returns 400 when dbName is longer than 63 characters', async () => {
      const response = await post(validBody({ dbName: 'a'.repeat(64) })).expect(
        400,
      );

      expect(response.body.message).toEqual([
        'dbName must be shorter than or equal to 63 characters',
      ]);
    });

    it('returns 400 when dbName has uppercase letters', async () => {
      const response = await post(validBody({ dbName: 'OrdersDb' })).expect(
        400,
      );

      expect(response.body.message).toEqual([NAME_MESSAGE]);
    });

    it('returns 400 when dbName starts with a digit', async () => {
      const response = await post(validBody({ dbName: '1orders' })).expect(400);

      expect(response.body.message).toEqual([NAME_MESSAGE]);
    });

    it('returns 400 when dbName contains a hyphen or a space', async () => {
      await post(validBody({ dbName: 'orders-db' })).expect(400);
      await post(validBody({ dbName: 'orders db' })).expect(400);
      expect(testApp.process.calls).toEqual([]);
    });

    it('returns 400 when dbName tries to close the quoted identifier and inject SQL', async () => {
      const response = await post(
        validBody({ dbName: 'x"; DROP DATABASE postgres; --' }),
      ).expect(400);

      expect(response.body.message).toEqual([NAME_MESSAGE]);
      expect(testApp.process.calls).toEqual([]);
      expect(await testApp.logRows()).toEqual([]);
    });

    it('returns 400 when dbName is a conninfo-like string', async () => {
      await post(
        validBody({ dbName: 'postgres host=evil.example.com' }),
      ).expect(400);
      expect(testApp.process.calls).toEqual([]);
    });

    it('returns 400 when dbName ends with a newline', async () => {
      await post(validBody({ dbName: 'orders\n' })).expect(400);
      expect(testApp.process.calls).toEqual([]);
    });

    it('returns 400 on an unknown property', async () => {
      const response = await post(validBody({ owner: 'root' })).expect(400);

      expect(response.body.message).toEqual([
        'property owner should not exist',
      ]);
      expect(testApp.process.calls).toEqual([]);
      expect(await testApp.logRows()).toEqual([]);
    });
  });

  describe('numberOfTickets validation', () => {
    it('returns 400 when numberOfTickets is missing', async () => {
      const { numberOfTickets, ...body } = validBody();
      expect(numberOfTickets).toBeDefined();

      const response = await post(body).expect(400);

      expect(response.body.message).toEqual(
        expect.arrayContaining([
          'numberOfTickets must be an integer number',
          'numberOfTickets should not be empty',
        ]),
      );
      expect(testApp.process.calls).toEqual([]);
    });

    it('returns 400 when numberOfTickets is null', async () => {
      await post(validBody({ numberOfTickets: null })).expect(400);
      expect(testApp.process.calls).toEqual([]);
    });

    it('returns 400 when numberOfTickets is a numeric string (no implicit conversion)', async () => {
      const response = await post(validBody({ numberOfTickets: '5' })).expect(
        400,
      );

      expect(response.body.message).toEqual([
        'numberOfTickets must be an integer number',
      ]);
      expect(testApp.process.calls).toEqual([]);
    });

    it('returns 400 when numberOfTickets is not an integer', async () => {
      const response = await post(validBody({ numberOfTickets: 1.5 })).expect(
        400,
      );

      expect(response.body.message).toEqual([
        'numberOfTickets must be an integer number',
      ]);
      expect(testApp.process.calls).toEqual([]);
    });

    it('documents current behavior: numberOfTickets 0 is accepted and logged', async () => {
      testApp.process.succeedWith(ansibleChangedOutput('Create database'));

      await post(validBody({ numberOfTickets: 0 })).expect(201);

      const rows = await testApp.logRows();
      expect(rows).toHaveLength(1);
      expect(rows[0].numberOfTicket).toBe(0);
      expect(testApp.process.calls).toHaveLength(1);
    });

    it('documents current behavior: a negative numberOfTickets is accepted and logged', async () => {
      testApp.process.succeedWith(ansibleChangedOutput('Create database'));

      await post(validBody({ numberOfTickets: -1 })).expect(201);

      const rows = await testApp.logRows();
      expect(rows).toHaveLength(1);
      expect(rows[0].numberOfTicket).toBe(-1);
      expect(testApp.process.calls).toHaveLength(1);
    });
  });

  describe('authentication', () => {
    it('returns 401 when the request has no bearer token', async () => {
      const response = await post(validBody(), null).expect(401);

      expect(response.body.message).toBe('Missing or malformed bearer token');
    });

    it('returns 401 for a non-bearer authorization scheme', async () => {
      const response = await post(validBody(), 'Basic YWRtaW46YWRtaW4=').expect(
        401,
      );

      expect(response.body.message).toBe('Missing or malformed bearer token');
    });

    it('returns 401 for a garbage token', async () => {
      const response = await post(validBody(), 'Bearer not-a-jwt').expect(401);

      expect(response.body.message).toBe('Invalid or expired token');
    });

    it('returns 401 for an expired token', async () => {
      const response = await post(
        validBody(),
        expiredAdminAuthorizationHeader(),
      ).expect(401);

      expect(response.body.message).toBe('Invalid or expired token');
    });

    it('returns 401 for a token signed with the wrong key', async () => {
      const response = await post(
        validBody(),
        wrongKeyAdminAuthorizationHeader(),
      ).expect(401);

      expect(response.body.message).toBe('Invalid or expired token');
    });

    it('returns 401 for a token with an unknown kid', async () => {
      const response = await post(
        validBody(),
        unknownKidAdminAuthorizationHeader(),
      ).expect(401);

      expect(response.body.message).toBe('Invalid or expired token');
    });

    it('authenticates before validating: an invalid payload without token is a 401', async () => {
      await post({}, null).expect(401);
    });

    it('never reaches the process layer nor the log when authentication fails', async () => {
      await post(validBody(), null).expect(401);
      await post(validBody(), 'Bearer not-a-jwt').expect(401);

      expect(testApp.process.calls).toEqual([]);
      expect(await testApp.logRows()).toEqual([]);
    });
  });

  describe('authorization', () => {
    it('returns 403 when the user has no ADMIN role', async () => {
      const response = await post(
        validBody(),
        authorizationHeaderFor({
          email: 'viewer@example.com',
          roles: ['VIEWER'],
        }),
      ).expect(403);

      expect(response.body.message).toBe('You do not have the required role');
      expect(testApp.process.calls).toEqual([]);
      expect(await testApp.logRows()).toEqual([]);
    });

    it('returns 403 when the role name differs only in case', async () => {
      await post(
        validBody(),
        authorizationHeaderFor({ email: 'a@example.com', roles: ['admin'] }),
      ).expect(403);
    });

    it('returns 403 when the user has an empty role list', async () => {
      await post(
        validBody(),
        authorizationHeaderFor({ email: 'a@example.com', roles: [] }),
      ).expect(403);
    });

    it('returns 403 when ADMIN was granted for another application', async () => {
      const response = await post(
        validBody(),
        authorizationHeaderFor({
          email: 'admin@example.com',
          roles: ['ADMIN'],
          applicationName: 'iam-api',
        }),
      ).expect(403);

      expect(response.body.message).toBe(
        'This token was not issued for the infra-hub-api application',
      );
      expect(testApp.process.calls).toEqual([]);
      expect(await testApp.logRows()).toEqual([]);
    });

    it('documents current behavior: a valid token without the apps claim yields 500, not 403', async () => {
      const response = await post(
        validBody(),
        authorizationHeaderForClaims({ email: 'admin@example.com' }),
      ).expect(500);

      expect(response.body).toEqual({
        statusCode: 500,
        message: 'Internal server error',
      });
      expect(testApp.process.calls).toEqual([]);
      expect(await testApp.logRows()).toEqual([]);
    });

    it('documents current behavior: an apps claim without roles yields 500, not 403', async () => {
      const response = await post(
        validBody(),
        authorizationHeaderForClaims({
          apps: { application: { id: 1, name: 'infra-hub-api-test' } },
        }),
      ).expect(500);

      expect(response.body.statusCode).toBe(500);
      expect(testApp.process.calls).toEqual([]);
    });
  });

  describe('hostile values (documents current behavior)', () => {
    async function run(overrides: Record<string, unknown>) {
      testApp.process.succeedWith(ansibleChangedOutput('Create database'));
      await post(validBody(overrides)).expect(201);
      expect(testApp.process.calls).toHaveLength(1);
      return load(testApp.process.calls[0].playbook);
    }

    it('documents current behavior: reserved/system database names pass the identifier check and are created through the process layer', async () => {
      expect(await run({ dbName: 'postgres' })).toEqual(
        expectedPlaybook('databases', 'postgres', 'postgres'),
      );
    });

    it('documents current behavior: --all-namespaces in namespace passes validation and becomes the value of -n', async () => {
      expect(await run({ namespace: '--all-namespaces' })).toEqual(
        expectedPlaybook('--all-namespaces', 'postgres', 'orders_db'),
      );
    });

    it('documents current behavior: a Jinja expression in deployment/namespace reaches argv verbatim', async () => {
      const jinja = "{{ lookup('pipe','id') }}";

      expect(await run({ deployment: jinja })).toEqual(
        expectedPlaybook('databases', jinja, 'orders_db'),
      );
    });
  });
});
