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

const PSQL_AS_POSTGRES_USER_SCRIPT =
  'if [ -z "$POSTGRES_USER" ]; then ' +
  'echo "POSTGRES_USER is not set in this deployment" >&2; exit 1; fi; ' +
  'exec psql -U "$POSTGRES_USER" "$@"';

const ENDPOINT = '/database-hub-api/list-databases';
const LIST_QUERY =
  'SELECT datname FROM pg_database WHERE datistemplate = false;';

function expectedPlaybook(namespace: string, deployment: string) {
  return [
    {
      hosts: 'all',
      gather_facts: false,
      tasks: [
        {
          name: 'List databases in target deployment',
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
              '-tAc',
              LIST_QUERY,
            ],
          },
          register: 'result',
        },
        {
          name: 'Emit database names',
          'ansible.builtin.debug': { msg: '{{ result.stdout }}' },
        },
      ],
    },
  ];
}

const DEFAULT_QUERY = { namespace: 'databases', deployment: 'postgres' };

describe('GET /database-hub-api/list-databases (e2e)', () => {
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
    query: string | Record<string, unknown> = DEFAULT_QUERY,
    authorization: string | null = ADMIN_AUTHORIZATION,
  ) {
    const req = testApp.http().get(ENDPOINT).query(query);
    if (authorization) {
      req.set('Authorization', authorization);
    }
    return req;
  }

  function succeedWithDatabases(msg: string) {
    testApp.process.succeedWith(
      ansibleDebugOutput('List databases in target deployment', msg),
    );
  }

  describe('success', () => {
    it('returns the database names parsed one per line from the ansible debug output', async () => {
      succeedWithDatabases('postgres\nappdb\nanalytics\n');

      const response = await get().expect(200);

      expect(response.body).toEqual({
        databases: ['postgres', 'appdb', 'analytics'],
      });
    });

    it('trims lines and drops blank ones', async () => {
      succeedWithDatabases('  postgres  \n\n   \nappdb\n');

      const response = await get().expect(200);

      expect(response.body).toEqual({ databases: ['postgres', 'appdb'] });
    });

    it('returns an empty list when psql printed nothing', async () => {
      succeedWithDatabases('');

      const response = await get().expect(200);

      expect(response.body).toEqual({ databases: [] });
    });

    it('hands ansible-playbook the exact args, timeout, playbook and SSH key', async () => {
      succeedWithDatabases('postgres');

      await get().expect(200);

      expect(testApp.process.calls).toHaveLength(1);
      const [call] = testApp.process.calls;
      expect(call.command).toBe('ansible-playbook');
      expect(call.args).toEqual(expectedAnsibleArgs(call));
      expect(call.options).toEqual({ timeout: 240000 });
      expect(load(call.playbook)).toEqual(
        expectedPlaybook('databases', 'postgres'),
      );
      expect(call.sshKey).toBe(TEST_SSH_PRIVATE_KEY);
      expect(call.sshKeyMode).toBe(0o600);
    });

    it('does not write an operations log row (read-only endpoint)', async () => {
      succeedWithDatabases('postgres');

      await get().expect(200);

      expect(await testApp.logRows()).toEqual([]);
    });
  });

  describe('process layer failures', () => {
    it('returns 502 with the psql/kubectl stderr when the command task fails', async () => {
      testApp.process.failWith({
        stdout: ansibleFatalOutput('List databases in target deployment', {
          stderr:
            'Error from server (NotFound): deployments.apps "ghost" not found',
        }),
      });

      const response = await get({
        namespace: 'databases',
        deployment: 'ghost',
      }).expect(502);

      expect(response.body).toEqual({
        statusCode: 502,
        error: 'Bad Gateway',
        message:
          'Failed to list databases: Error from server (NotFound): deployments.apps "ghost" not found',
      });
    });

    it('returns 502 with the ansible msg when the host is unreachable', async () => {
      testApp.process.failWith({
        code: 4,
        stdout:
          'fatal: [pcbox.test]: UNREACHABLE! => {"changed": false, "msg": "Failed to connect to the host via ssh", "unreachable": true}',
      });

      const response = await get().expect(502);

      expect(response.body.message).toBe(
        'Failed to list databases: Failed to connect to the host via ssh',
      );
    });

    it('falls back to the process error message when there is no other detail', async () => {
      testApp.process.failWith({
        message: 'Command failed: ansible-playbook (timed out)',
        code: 'ETIMEDOUT',
      });

      const response = await get().expect(502);

      expect(response.body.message).toBe(
        'Failed to list databases: Command failed: ansible-playbook (timed out)',
      );
    });

    it('returns 502 when ansible succeeded but printed no debug message', async () => {
      testApp.process.succeedWith('PLAY RECAP: ok=1 changed=0 failed=0');

      const response = await get().expect(502);

      expect(response.body).toEqual({
        statusCode: 502,
        error: 'Bad Gateway',
        message: 'Failed to list databases',
      });
    });

    it('documents current behavior: a non-ExecFileError from the exec layer becomes a 500', async () => {
      testApp.process.throwWith(new Error('spawn ansible-playbook ENOENT'));

      const response = await get().expect(500);

      expect(response.body).toEqual({
        statusCode: 500,
        message: 'Internal server error',
      });
      expect(testApp.process.calls).toHaveLength(1);
    });
  });

  describe('validation', () => {
    it('returns 400 when both query parameters are missing', async () => {
      const response = await get({}).expect(400);

      expect(response.body.message).toEqual(
        expect.arrayContaining([
          'namespace should not be empty',
          'namespace must be a string',
          'deployment should not be empty',
          'deployment must be a string',
        ]),
      );
      expect(testApp.process.calls).toEqual([]);
    });

    it('returns 400 when namespace is missing', async () => {
      const response = await get({ deployment: 'postgres' }).expect(400);

      expect(response.body.message).toEqual(
        expect.arrayContaining(['namespace must be a string']),
      );
      expect(testApp.process.calls).toEqual([]);
    });

    it('returns 400 when deployment is missing', async () => {
      const response = await get({ namespace: 'databases' }).expect(400);

      expect(response.body.message).toEqual(
        expect.arrayContaining(['deployment must be a string']),
      );
      expect(testApp.process.calls).toEqual([]);
    });

    it('returns 400 when namespace is empty', async () => {
      const response = await get('namespace=&deployment=postgres').expect(400);

      expect(response.body.message).toEqual(['namespace should not be empty']);
    });

    it('returns 400 when deployment is empty', async () => {
      const response = await get('namespace=databases&deployment=').expect(400);

      expect(response.body.message).toEqual(['deployment should not be empty']);
    });

    it('returns 400 when deployment is repeated (array instead of string)', async () => {
      const response = await get(
        'namespace=databases&deployment=a&deployment=b',
      ).expect(400);

      expect(response.body.message).toEqual(
        expect.arrayContaining(['deployment must be a string']),
      );
      expect(testApp.process.calls).toEqual([]);
    });

    it('returns 400 when namespace is longer than 63 characters', async () => {
      const response = await get({
        namespace: 'a'.repeat(64),
        deployment: 'postgres',
      }).expect(400);

      expect(response.body.message).toEqual([
        'namespace must be shorter than or equal to 63 characters',
      ]);
    });

    it('returns 400 when deployment is longer than 63 characters', async () => {
      const response = await get({
        namespace: 'databases',
        deployment: 'a'.repeat(64),
      }).expect(400);

      expect(response.body.message).toEqual([
        'deployment must be shorter than or equal to 63 characters',
      ]);
    });

    it('accepts namespace and deployment of exactly 63 characters', async () => {
      succeedWithDatabases('postgres');

      await get({
        namespace: 'a'.repeat(63),
        deployment: 'b'.repeat(63),
      }).expect(200);

      expect(testApp.process.calls).toHaveLength(1);
    });

    it('returns 400 on an unknown query property', async () => {
      const response = await get({ ...DEFAULT_QUERY, dbName: 'x' }).expect(400);

      expect(response.body.message).toEqual([
        'property dbName should not exist',
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

    it('authenticates before validating: an invalid payload without token is a 401', async () => {
      await get({}, null).expect(401);
    });

    it('never reaches the process layer nor the log when authentication fails', async () => {
      await get(undefined, null).expect(401);
      await get(undefined, 'Bearer not-a-jwt').expect(401);

      expect(testApp.process.calls).toEqual([]);
      expect(await testApp.logRows()).toEqual([]);
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
      expect(await testApp.logRows()).toEqual([]);
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
      expect(await testApp.logRows()).toEqual([]);
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
      expect(await testApp.logRows()).toEqual([]);
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
    async function run(namespace: string, deployment: string) {
      succeedWithDatabases('postgres');
      await get({ namespace, deployment }).expect(200);
      expect(testApp.process.calls).toHaveLength(1);
      return load(testApp.process.calls[0].playbook);
    }

    it('documents current behavior: --all-namespaces passes validation and becomes the value of -n', async () => {
      expect(await run('--all-namespaces', 'postgres')).toEqual(
        expectedPlaybook('--all-namespaces', 'postgres'),
      );
    });

    it('documents current behavior: a Jinja expression in deployment reaches argv verbatim', async () => {
      const deployment = "{{ lookup('pipe','id') }}";

      expect(await run('databases', deployment)).toEqual(
        expectedPlaybook('databases', deployment),
      );
    });

    it('documents current behavior: shell metacharacters and extra kubectl flags in deployment stay one argv entry', async () => {
      const deployment = 'postgres -n kube-system; id';

      expect(await run('databases', deployment)).toEqual(
        expectedPlaybook('databases', deployment),
      );
    });

    it('documents current behavior: a Jinja expression in namespace reaches argv verbatim', async () => {
      const namespace = "{{ lookup('pipe','id') }}";

      expect(await run(namespace, 'postgres')).toEqual(
        expectedPlaybook(namespace, 'postgres'),
      );
    });
  });
});
