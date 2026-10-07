import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from '@jest/globals';
import { load } from 'js-yaml';
import {
  AppTestApp,
  createAppTestApp,
  expectedAnsibleArgs,
  TEST_SSH_PRIVATE_KEY,
} from '../helpers/app-test-app';
import {
  ansibleDebugOutput,
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

const ENDPOINT = '/kubernates-hub-api/list-deployments';

function expectedPlaybook(namespace: string) {
  return [
    {
      hosts: 'all',
      gather_facts: false,
      tasks: [
        {
          name: 'List deployments in namespace',
          'ansible.builtin.command': {
            argv: [
              'microk8s',
              'kubectl',
              'get',
              'deployments',
              '-n',
              namespace,
              '-o',
              'jsonpath={.items[*].metadata.name}',
            ],
          },
          register: 'result',
        },
        {
          name: 'Emit deployment names',
          'ansible.builtin.debug': { msg: '{{ result.stdout }}' },
        },
      ],
    },
  ];
}

describe('GET /kubernates-hub-api/list-deployments (e2e)', () => {
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

  function get(
    query: string | Record<string, unknown> = { namespace: 'payments' },
    authorization: string | null = ADMIN_AUTHORIZATION,
  ) {
    const req = testApp.http().get(ENDPOINT).query(query);
    if (authorization) {
      req.set('Authorization', authorization);
    }
    return req;
  }

  describe('success', () => {
    it('returns the deployment names parsed from the ansible debug output', async () => {
      testApp.process.succeedWith(
        ansibleDebugOutput(
          'List deployments in namespace',
          'api-gateway payments-worker\n',
        ),
      );

      const response = await get().expect(200);

      expect(response.body).toEqual({
        deployments: ['api-gateway', 'payments-worker'],
      });
    });

    it('returns an empty list when the namespace has no deployments', async () => {
      testApp.process.succeedWith(
        ansibleDebugOutput('List deployments in namespace', ''),
      );

      const response = await get().expect(200);

      expect(response.body).toEqual({ deployments: [] });
    });

    it('hands ansible-playbook the exact args, timeout, playbook and SSH key', async () => {
      testApp.process.succeedWith(
        ansibleDebugOutput('List deployments in namespace', 'api'),
      );

      await get({ namespace: 'payments' }).expect(200);

      expect(testApp.process.calls).toHaveLength(1);
      const [call] = testApp.process.calls;
      expect(call.command).toBe('ansible-playbook');
      expect(call.args).toEqual(expectedAnsibleArgs(call));
      expect(call.options).toEqual({ timeout: 240000 });
      expect(load(call.playbook)).toEqual(expectedPlaybook('payments'));
      expect(call.sshKey).toBe(TEST_SSH_PRIVATE_KEY);
      expect(call.sshKeyMode).toBe(0o600);
    });

    it('does not write an operations log row (read-only endpoint)', async () => {
      testApp.process.succeedWith(
        ansibleDebugOutput('List deployments in namespace', 'api'),
      );

      await get().expect(200);

      expect(await testApp.logRows()).toEqual([]);
    });
  });

  describe('process layer failures', () => {
    it('returns 502 with the kubectl stderr when the command task fails', async () => {
      testApp.process.failWith({
        stdout: ansibleFatalOutput('List deployments in namespace', {
          stderr: 'Error from server (NotFound): namespaces "nope" not found',
        }),
      });

      const response = await get({ namespace: 'nope' }).expect(502);

      expect(response.body).toEqual({
        statusCode: 502,
        error: 'Bad Gateway',
        message:
          'Failed to list deployments: Error from server (NotFound): namespaces "nope" not found',
      });
    });

    it('returns 502 with the ansible msg when the host is unreachable', async () => {
      testApp.process.failWith({
        code: 4,
        stdout:
          'fatal: [pcbox.test]: UNREACHABLE! => {"changed": false, "msg": "Failed to connect to the host via ssh: Connection timed out", "unreachable": true}',
      });

      const response = await get().expect(502);

      expect(response.body.message).toBe(
        'Failed to list deployments: Failed to connect to the host via ssh: Connection timed out',
      );
    });

    it('falls back to the ansible-playbook stderr when stdout has no failure detail', async () => {
      testApp.process.failWith({ stdout: '', stderr: 'ERROR! no inventory' });

      const response = await get().expect(502);

      expect(response.body.message).toBe(
        'Failed to list deployments: ERROR! no inventory',
      );
    });

    it('falls back to the process error message when there is no other detail', async () => {
      testApp.process.failWith({
        message: 'Command failed: ansible-playbook (timed out)',
        code: 'ETIMEDOUT',
      });

      const response = await get().expect(502);

      expect(response.body.message).toBe(
        'Failed to list deployments: Command failed: ansible-playbook (timed out)',
      );
    });

    it('returns 502 when ansible succeeded but printed no debug message', async () => {
      testApp.process.succeedWith('PLAY RECAP: ok=1 changed=0 failed=0');

      const response = await get().expect(502);

      expect(response.body).toEqual({
        statusCode: 502,
        error: 'Bad Gateway',
        message: 'Failed to list deployments',
      });
    });

    it('documents current behavior: a non-ExecFileError from the exec layer becomes a 500', async () => {
      testApp.process.throwWith(new Error('spawn ansible-playbook ENOENT'));

      const response = await get().expect(500);

      expect(response.body).toEqual({
        statusCode: 500,
        message: 'Internal server error',
      });
      // The temp playbook/SSH key are removed even when execution blows up
      // (checked in afterEach through leftoverTempEntries).
      expect(testApp.process.calls).toHaveLength(1);
    });
  });

  describe('validation', () => {
    it('returns 400 when namespace is missing', async () => {
      const response = await get({}).expect(400);

      expect(response.body.message).toEqual([
        'namespace must be shorter than or equal to 63 characters',
        'namespace should not be empty',
        'namespace must be a string',
      ]);
      expect(testApp.process.calls).toEqual([]);
    });

    it('returns 400 when namespace is empty', async () => {
      const response = await get('namespace=').expect(400);

      expect(response.body.message).toEqual(['namespace should not be empty']);
      expect(testApp.process.calls).toEqual([]);
    });

    it('returns 400 when namespace is repeated (array instead of string)', async () => {
      const response = await get('namespace=a&namespace=b').expect(400);

      expect(response.body.message).toEqual(
        expect.arrayContaining(['namespace must be a string']),
      );
      expect(testApp.process.calls).toEqual([]);
    });

    it('returns 400 when namespace is longer than 63 characters', async () => {
      const response = await get({ namespace: 'a'.repeat(64) }).expect(400);

      expect(response.body.message).toEqual([
        'namespace must be shorter than or equal to 63 characters',
      ]);
      expect(testApp.process.calls).toEqual([]);
    });

    it('accepts a namespace of exactly 63 characters', async () => {
      testApp.process.succeedWith(
        ansibleDebugOutput('List deployments in namespace', 'api'),
      );

      await get({ namespace: 'a'.repeat(63) }).expect(200);

      expect(testApp.process.calls).toHaveLength(1);
    });

    it('returns 400 on an unknown query property', async () => {
      const response = await get({
        namespace: 'payments',
        allNamespaces: 'true',
      }).expect(400);

      expect(response.body.message).toEqual([
        'property allNamespaces should not exist',
      ]);
      expect(testApp.process.calls).toEqual([]);
    });
  });

  describe('authentication', () => {
    it('returns 401 when the request has no bearer token', async () => {
      const response = await get(undefined, null).expect(401);

      expect(response.body.message).toBe('Missing or malformed bearer token');
    });

    it('returns 401 for a non-bearer authorization scheme', async () => {
      const response = await get(undefined, 'Basic YWRtaW46YWRtaW4=').expect(
        401,
      );

      expect(response.body.message).toBe('Missing or malformed bearer token');
    });

    it('returns 401 for a garbage token', async () => {
      const response = await get(undefined, 'Bearer not-a-jwt').expect(401);

      expect(response.body.message).toBe('Invalid or expired token');
    });

    it('returns 401 for an expired token', async () => {
      const response = await get(
        undefined,
        expiredAdminAuthorizationHeader(),
      ).expect(401);

      expect(response.body.message).toBe('Invalid or expired token');
    });

    it('returns 401 for a token signed with the wrong key', async () => {
      const response = await get(
        undefined,
        wrongKeyAdminAuthorizationHeader(),
      ).expect(401);

      expect(response.body.message).toBe('Invalid or expired token');
    });

    it('returns 401 for a token with an unknown kid', async () => {
      const response = await get(
        undefined,
        unknownKidAdminAuthorizationHeader(),
      ).expect(401);

      expect(response.body.message).toBe('Invalid or expired token');
    });

    it('authenticates before validating: an invalid query without token is a 401', async () => {
      await get({}, null).expect(401);
    });

    it('never reaches the process layer when authentication fails', async () => {
      await get(undefined, null).expect(401);
      await get(undefined, 'Bearer not-a-jwt').expect(401);

      expect(testApp.process.calls).toEqual([]);
    });
  });

  describe('authorization', () => {
    it('returns 403 when the user has no ADMIN role', async () => {
      const response = await get(
        undefined,
        authorizationHeaderFor({
          email: 'viewer@example.com',
          roles: ['VIEWER'],
        }),
      ).expect(403);

      expect(response.body.message).toBe('You do not have the required role');
      expect(testApp.process.calls).toEqual([]);
    });

    it('returns 403 when the role name differs only in case', async () => {
      await get(
        undefined,
        authorizationHeaderFor({ email: 'a@example.com', roles: ['admin'] }),
      ).expect(403);
    });

    it('returns 403 when the user has an empty role list', async () => {
      await get(
        undefined,
        authorizationHeaderFor({ email: 'a@example.com', roles: [] }),
      ).expect(403);
    });

    it('returns 403 when ADMIN was granted for another application', async () => {
      const response = await get(
        undefined,
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
    });

    it('documents current behavior: a valid token without the apps claim yields 500, not 403', async () => {
      const response = await get(
        undefined,
        authorizationHeaderForClaims({ email: 'admin@example.com' }),
      ).expect(500);

      expect(response.body).toEqual({
        statusCode: 500,
        message: 'Internal server error',
      });
      expect(testApp.process.calls).toEqual([]);
    });

    it('documents current behavior: an apps claim without roles yields 500, not 403', async () => {
      const response = await get(
        undefined,
        authorizationHeaderForClaims({
          apps: { application: { id: 1, name: 'infra-hub-api-test' } },
        }),
      ).expect(500);

      expect(response.body.statusCode).toBe(500);
      expect(testApp.process.calls).toEqual([]);
    });
  });

  describe('hostile values (documents current behavior)', () => {
    async function runWithNamespace(namespace: string) {
      testApp.process.succeedWith(
        ansibleDebugOutput('List deployments in namespace', 'api'),
      );
      await get({ namespace }).expect(200);
      expect(testApp.process.calls).toHaveLength(1);
      const [call] = testApp.process.calls;
      const [play] = load(call.playbook) as ReturnType<typeof expectedPlaybook>;
      return {
        call,
        argv: (
          play.tasks[0] as { 'ansible.builtin.command': { argv: string[] } }
        )['ansible.builtin.command'].argv,
        playbook: load(call.playbook),
      };
    }

    it('documents current behavior: --all-namespaces passes validation and becomes the value of -n', async () => {
      const { argv, playbook } = await runWithNamespace('--all-namespaces');

      expect(argv).toEqual([
        'microk8s',
        'kubectl',
        'get',
        'deployments',
        '-n',
        '--all-namespaces',
        '-o',
        'jsonpath={.items[*].metadata.name}',
      ]);
      expect(playbook).toEqual(expectedPlaybook('--all-namespaces'));
    });

    it('documents current behavior: a Jinja expression in namespace reaches the playbook verbatim', async () => {
      const jinja = "{{ lookup('pipe','id') }}";

      const { argv, playbook } = await runWithNamespace(jinja);

      expect(argv[5]).toBe(jinja);
      expect(playbook).toEqual(expectedPlaybook(jinja));
    });

    it('documents current behavior: shell metacharacters are not rejected and stay one argv element', async () => {
      const hostile = 'prod; rm -rf / && $(id) `id` | tee /tmp/x';

      const { argv } = await runWithNamespace(hostile);

      expect(argv[5]).toBe(hostile);
    });

    it('documents current behavior: a namespace starting with a dash is treated as a flag value, not rejected', async () => {
      const { argv } = await runWithNamespace('-A');

      expect(argv.slice(4, 6)).toEqual(['-n', '-A']);
    });
  });
});
