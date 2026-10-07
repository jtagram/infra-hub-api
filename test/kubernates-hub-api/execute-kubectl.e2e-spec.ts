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

const ENDPOINT = '/kubernates-hub-api/execute-kubectl';

function validBody(overrides: Record<string, unknown> = {}) {
  return {
    numberOfTickets: 42,
    kubectlCommand: 'get pods -n payments',
    ...overrides,
  };
}

function expectedPlaybook(kubectlArgs: string[]) {
  return [
    {
      hosts: 'all',
      gather_facts: false,
      tasks: [
        {
          name: 'run kubectl command',
          'ansible.builtin.command': {
            argv: ['microk8s', 'kubectl', ...kubectlArgs],
          },
        },
      ],
    },
  ];
}

describe('POST /kubernates-hub-api/execute-kubectl (e2e)', () => {
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
      const stdout = ansibleChangedOutput('run kubectl command');
      testApp.process.succeedWith(stdout);

      const response = await post(validBody()).expect(201);

      expect(response.body).toEqual({
        executionResult: { success: true, stdout, stderr: '', exitCode: 0 },
        logId: expect.stringMatching(/^[0-9a-f-]{36}$/),
      });
    });

    it('hands ansible-playbook the exact args, timeout, playbook and SSH key', async () => {
      testApp.process.succeedWith(ansibleChangedOutput('run kubectl command'));

      await post(validBody()).expect(201);

      expect(testApp.process.calls).toHaveLength(1);
      const [call] = testApp.process.calls;
      expect(call.command).toBe('ansible-playbook');
      expect(call.args).toEqual(expectedAnsibleArgs(call));
      expect(call.options).toEqual({ timeout: 240000 });
      expect(load(call.playbook)).toEqual(
        expectedPlaybook(['get', 'pods', '-n', 'payments']),
      );
      expect(call.sshKey).toBe(TEST_SSH_PRIVATE_KEY);
      expect(call.sshKeyMode).toBe(0o600);
    });

    it('persists one KUBERNETES operations log row with the command and the response', async () => {
      testApp.process.succeedWith(ansibleChangedOutput('run kubectl command'));

      const response = await post(validBody()).expect(201);

      const rows = await testApp.logRows();
      expect(rows).toHaveLength(1);
      expect(rows[0].id).toBe(response.body.logId);
      expect(rows[0].department).toBe(InfrastructureDepartment.KUBERNETES);
      expect(rows[0].numberOfTicket).toBe(42);
      expect(JSON.parse(rows[0].instruction)).toEqual({
        kubectlCommand: 'get pods -n payments',
      });
      expect(JSON.parse(rows[0].response)).toEqual(
        response.body.executionResult,
      );
    });

    it('trims the command and splits it on any run of whitespace', async () => {
      testApp.process.succeedWith(ansibleChangedOutput('run kubectl command'));

      await post(
        validBody({ kubectlCommand: '  get   pods\t-n\npayments  ' }),
      ).expect(201);

      expect(load(testApp.process.calls[0].playbook)).toEqual(
        expectedPlaybook(['get', 'pods', '-n', 'payments']),
      );
      // The log keeps the raw, untrimmed command.
      const [row] = await testApp.logRows();
      expect(JSON.parse(row.instruction)).toEqual({
        kubectlCommand: '  get   pods\t-n\npayments  ',
      });
    });
  });

  describe('process layer failures', () => {
    it('returns 201 with success false and logs it when kubectl fails', async () => {
      const stdout = ansibleFatalOutput('run kubectl command', {
        stderr: 'Error from server (NotFound): pods "ghost" not found',
      });
      testApp.process.failWith({ code: 2, stdout });

      const response = await post(
        validBody({ kubectlCommand: 'get pod ghost' }),
      ).expect(201);

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
      testApp.process.succeedWith(ansibleChangedOutput('run kubectl command'));
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
          'kubectlCommand must be a string',
        ]),
      );
      expect(testApp.process.calls).toEqual([]);
    });

    it('returns 400 when kubectlCommand is missing', async () => {
      const { kubectlCommand, ...body } = validBody();
      expect(kubectlCommand).toBeDefined();

      const response = await post(body).expect(400);

      expect(response.body.message).toEqual(
        expect.arrayContaining(['kubectlCommand must be a string']),
      );
    });

    it('returns 400 when kubectlCommand is empty', async () => {
      const response = await post(validBody({ kubectlCommand: '' })).expect(
        400,
      );

      expect(response.body.message).toEqual([
        'kubectlCommand should not be empty',
      ]);
    });

    it('returns 400 when kubectlCommand is not a string', async () => {
      const response = await post(
        validBody({ kubectlCommand: ['get', 'pods'] }),
      ).expect(400);

      expect(response.body.message).toEqual(
        expect.arrayContaining(['kubectlCommand must be a string']),
      );
    });

    it('returns 400 when kubectlCommand is longer than 4000 characters', async () => {
      const response = await post(
        validBody({ kubectlCommand: 'a'.repeat(4001) }),
      ).expect(400);

      expect(response.body.message).toEqual([
        'kubectlCommand must be shorter than or equal to 4000 characters',
      ]);
      expect(testApp.process.calls).toEqual([]);
    });

    it('accepts a kubectlCommand of exactly 4000 characters', async () => {
      testApp.process.succeedWith(ansibleChangedOutput('run kubectl command'));

      await post(validBody({ kubectlCommand: 'a'.repeat(4000) })).expect(201);

      expect(testApp.process.calls).toHaveLength(1);
    });

    it('returns 400 on an unknown property', async () => {
      const response = await post(validBody({ namespace: 'payments' })).expect(
        400,
      );

      expect(response.body.message).toEqual([
        'property namespace should not exist',
      ]);
      expect(testApp.process.calls).toEqual([]);
      expect(await testApp.logRows()).toEqual([]);
    });

    it('documents current behavior: a whitespace-only command passes validation and runs `kubectl` with an empty argument', async () => {
      testApp.process.succeedWith(ansibleChangedOutput('run kubectl command'));

      await post(validBody({ kubectlCommand: '   ' })).expect(201);

      expect(load(testApp.process.calls[0].playbook)).toEqual(
        expectedPlaybook(['']),
      );
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
      testApp.process.succeedWith(ansibleChangedOutput('run kubectl command'));

      await post(validBody({ numberOfTickets: 0 })).expect(201);

      const rows = await testApp.logRows();
      expect(rows).toHaveLength(1);
      expect(rows[0].numberOfTicket).toBe(0);
      expect(testApp.process.calls).toHaveLength(1);
    });

    it('documents current behavior: a negative numberOfTickets is accepted and logged', async () => {
      testApp.process.succeedWith(ansibleChangedOutput('run kubectl command'));

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
    async function run(kubectlCommand: string) {
      testApp.process.succeedWith(ansibleChangedOutput('run kubectl command'));
      await post(validBody({ kubectlCommand })).expect(201);
      expect(testApp.process.calls).toHaveLength(1);
      return load(testApp.process.calls[0].playbook);
    }

    it('documents current behavior: --all-namespaces passes validation and reaches kubectl', async () => {
      expect(await run('get pods --all-namespaces')).toEqual(
        expectedPlaybook(['get', 'pods', '--all-namespaces']),
      );
    });

    it('documents current behavior: secrets of every namespace can be read', async () => {
      expect(await run('get secrets -A -o yaml')).toEqual(
        expectedPlaybook(['get', 'secrets', '-A', '-o', 'yaml']),
      );
    });

    it('documents current behavior: destructive subcommands such as deleting a namespace are allowed', async () => {
      expect(await run('delete namespace production')).toEqual(
        expectedPlaybook(['delete', 'namespace', 'production']),
      );
    });

    it('documents current behavior: exec into a pod with an arbitrary command is allowed', async () => {
      expect(await run('exec -n payments api-0 -- sh -c id')).toEqual(
        expectedPlaybook([
          'exec',
          '-n',
          'payments',
          'api-0',
          '--',
          'sh',
          '-c',
          'id',
        ]),
      );
    });

    it('documents current behavior: shell metacharacters are not rejected, they become separate literal argv entries', async () => {
      expect(await run('get pods; id && cat /etc/passwd | tee /tmp/x')).toEqual(
        expectedPlaybook([
          'get',
          'pods;',
          'id',
          '&&',
          'cat',
          '/etc/passwd',
          '|',
          'tee',
          '/tmp/x',
        ]),
      );
    });

    it('documents current behavior: a Jinja expression without spaces reaches argv as a single templatable token', async () => {
      expect(await run("get pods {{lookup('pipe','id')}}")).toEqual(
        expectedPlaybook(['get', 'pods', "{{lookup('pipe','id')}}"]),
      );
    });

    it('documents current behavior: a Jinja expression with spaces is split into broken fragments', async () => {
      expect(await run("get pods {{ lookup('pipe','id') }}")).toEqual(
        expectedPlaybook(['get', 'pods', '{{', "lookup('pipe','id')", '}}']),
      );
    });

    it('documents current behavior: quotes are not interpreted, they stay inside the argv entries', async () => {
      expect(await run('get pods -l "app=api tier=web"')).toEqual(
        expectedPlaybook(['get', 'pods', '-l', '"app=api', 'tier=web"']),
      );
    });

    it('documents current behavior: a leading `kubectl` word is not stripped and is passed as a kubectl argument', async () => {
      expect(await run('kubectl get pods')).toEqual(
        expectedPlaybook(['kubectl', 'get', 'pods']),
      );
    });
  });
});
