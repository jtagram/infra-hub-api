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

const ENDPOINT = '/kubernates-hub-api/manage-manifest';

const MANIFEST = `apiVersion: apps/v1
kind: Deployment
metadata:
  name: api
  namespace: payments
spec:
  replicas: 2
  selector:
    matchLabels:
      app: api
  template:
    metadata:
      labels:
        app: api
    spec:
      containers:
        - name: api
          image: registry.example.com/api:1.4.2
---
apiVersion: v1
kind: Service
metadata:
  name: api
spec:
  selector:
    app: api
  ports:
    - port: 80
`;

function validBody(overrides: Record<string, unknown> = {}) {
  return {
    numberOfTickets: 42,
    namespace: 'payments',
    action: 'apply',
    manifest: MANIFEST,
    ...overrides,
  };
}

function expectedPlaybook(action: string, namespace: string, manifest: string) {
  return [
    {
      hosts: 'all',
      gather_facts: false,
      tasks: [
        {
          name: `kubectl ${action} manifest`,
          'ansible.builtin.command': {
            argv: ['microk8s', 'kubectl', action, '-n', namespace, '-f', '-'],
            stdin: manifest,
          },
        },
      ],
    },
  ];
}

describe('POST /kubernates-hub-api/manage-manifest (e2e)', () => {
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
      const stdout = ansibleChangedOutput('kubectl apply manifest');
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

    it('hands ansible-playbook the exact args, timeout, playbook (manifest as stdin) and SSH key for apply', async () => {
      testApp.process.succeedWith(
        ansibleChangedOutput('kubectl apply manifest'),
      );

      await post(validBody()).expect(201);

      expect(testApp.process.calls).toHaveLength(1);
      const [call] = testApp.process.calls;
      expect(call.command).toBe('ansible-playbook');
      expect(call.args).toEqual(expectedAnsibleArgs(call));
      expect(call.options).toEqual({ timeout: 240000 });
      expect(load(call.playbook)).toEqual(
        expectedPlaybook('apply', 'payments', MANIFEST),
      );
      expect(call.sshKey).toBe(TEST_SSH_PRIVATE_KEY);
      expect(call.sshKeyMode).toBe(0o600);
    });

    it('builds a kubectl delete invocation for the delete action', async () => {
      testApp.process.succeedWith(
        ansibleChangedOutput('kubectl delete manifest'),
      );

      await post(validBody({ action: 'delete' })).expect(201);

      expect(load(testApp.process.calls[0].playbook)).toEqual(
        expectedPlaybook('delete', 'payments', MANIFEST),
      );
    });

    it('builds a kubectl create invocation for the create action', async () => {
      testApp.process.succeedWith(
        ansibleChangedOutput('kubectl create manifest'),
      );

      await post(validBody({ action: 'create' })).expect(201);

      expect(load(testApp.process.calls[0].playbook)).toEqual(
        expectedPlaybook('create', 'payments', MANIFEST),
      );
    });

    it('persists one KUBERNETES operations log row with the instruction and the response', async () => {
      testApp.process.succeedWith(
        ansibleChangedOutput('kubectl apply manifest'),
      );

      const response = await post(validBody()).expect(201);

      const rows = await testApp.logRows();
      expect(rows).toHaveLength(1);
      expect(rows[0].id).toBe(response.body.logId);
      expect(rows[0].department).toBe(InfrastructureDepartment.KUBERNETES);
      expect(rows[0].numberOfTicket).toBe(42);
      expect(JSON.parse(rows[0].instruction)).toEqual({
        action: 'apply',
        manifest: MANIFEST,
      });
      expect(JSON.parse(rows[0].response)).toEqual(
        response.body.executionResult,
      );
    });

    it('does not log the namespace in the instruction (only action and manifest)', async () => {
      testApp.process.succeedWith(
        ansibleChangedOutput('kubectl apply manifest'),
      );

      await post(validBody({ namespace: 'billing' })).expect(201);

      const [row] = await testApp.logRows();
      expect(Object.keys(JSON.parse(row.instruction))).toEqual([
        'action',
        'manifest',
      ]);
    });
  });

  describe('process layer failures', () => {
    it('returns 201 with success false and logs it when kubectl fails', async () => {
      const stdout = ansibleFatalOutput('kubectl apply manifest', {
        stderr: 'error: error validating "STDIN": unknown field "replica"',
      });
      testApp.process.failWith({
        message: 'Command failed: ansible-playbook',
        code: 2,
        stdout,
        stderr: '',
      });

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
      testApp.process.succeedWith(
        ansibleChangedOutput('kubectl apply manifest'),
      );
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
          'namespace must be a string',
          'action must be one of the following values: apply, delete, create',
          'manifest must be a string',
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

    it('returns 400 when namespace is empty', async () => {
      const response = await post(validBody({ namespace: '' })).expect(400);

      expect(response.body.message).toEqual(['namespace should not be empty']);
    });

    it('returns 400 when namespace is not a string', async () => {
      const response = await post(validBody({ namespace: 123 })).expect(400);

      expect(response.body.message).toEqual(
        expect.arrayContaining(['namespace must be a string']),
      );
    });

    it('returns 400 when namespace is longer than 63 characters', async () => {
      const response = await post(
        validBody({ namespace: 'a'.repeat(64) }),
      ).expect(400);

      expect(response.body.message).toEqual([
        'namespace must be shorter than or equal to 63 characters',
      ]);
    });

    it('accepts a namespace of exactly 63 characters', async () => {
      testApp.process.succeedWith(
        ansibleChangedOutput('kubectl apply manifest'),
      );

      await post(validBody({ namespace: 'a'.repeat(63) })).expect(201);
    });

    it('returns 400 when action is missing', async () => {
      const { action, ...body } = validBody();
      expect(action).toBeDefined();

      const response = await post(body).expect(400);

      expect(response.body.message).toEqual([
        'action must be one of the following values: apply, delete, create',
      ]);
    });

    it('returns 400 for an unsupported action', async () => {
      const response = await post(validBody({ action: 'replace' })).expect(400);

      expect(response.body.message).toEqual([
        'action must be one of the following values: apply, delete, create',
      ]);
      expect(testApp.process.calls).toEqual([]);
    });

    it('returns 400 when the action differs only in case', async () => {
      await post(validBody({ action: 'APPLY' })).expect(400);
      expect(testApp.process.calls).toEqual([]);
    });

    it('returns 400 when manifest is missing', async () => {
      const { manifest, ...body } = validBody();
      expect(manifest).toBeDefined();

      const response = await post(body).expect(400);

      expect(response.body.message).toEqual(
        expect.arrayContaining(['manifest must be a string']),
      );
    });

    it('returns 400 when manifest is empty', async () => {
      const response = await post(validBody({ manifest: '' })).expect(400);

      expect(response.body.message).toEqual(['manifest should not be empty']);
    });

    it('returns 400 when manifest is not a string', async () => {
      const response = await post(
        validBody({ manifest: { kind: 'Pod' } }),
      ).expect(400);

      expect(response.body.message).toEqual(
        expect.arrayContaining(['manifest must be a string']),
      );
    });

    it('returns 400 when manifest is longer than 20000 characters', async () => {
      const response = await post(
        validBody({ manifest: 'a'.repeat(20001) }),
      ).expect(400);

      expect(response.body.message).toEqual([
        'manifest must be shorter than or equal to 20000 characters',
      ]);
      expect(testApp.process.calls).toEqual([]);
    });

    it('accepts a manifest of exactly 20000 characters', async () => {
      testApp.process.succeedWith(
        ansibleChangedOutput('kubectl apply manifest'),
      );

      await post(validBody({ manifest: 'a'.repeat(20000) })).expect(201);

      expect(testApp.process.calls).toHaveLength(1);
    });

    it('returns 400 on an unknown property', async () => {
      const response = await post(validBody({ dryRun: true })).expect(400);

      expect(response.body.message).toEqual([
        'property dryRun should not exist',
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
      testApp.process.succeedWith(
        ansibleChangedOutput('kubectl apply manifest'),
      );

      await post(validBody({ numberOfTickets: 0 })).expect(201);

      const rows = await testApp.logRows();
      expect(rows).toHaveLength(1);
      expect(rows[0].numberOfTicket).toBe(0);
      expect(testApp.process.calls).toHaveLength(1);
    });

    it('documents current behavior: a negative numberOfTickets is accepted and logged', async () => {
      testApp.process.succeedWith(
        ansibleChangedOutput('kubectl apply manifest'),
      );

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
    it('documents current behavior: a Jinja expression in the manifest reaches the playbook stdin verbatim', async () => {
      const manifest = `apiVersion: v1
kind: ConfigMap
metadata:
  name: pwned
data:
  out: "{{ lookup('pipe','id') }}"
`;
      testApp.process.succeedWith(
        ansibleChangedOutput('kubectl apply manifest'),
      );

      await post(validBody({ manifest })).expect(201);

      const [call] = testApp.process.calls;
      expect(load(call.playbook)).toEqual(
        expectedPlaybook('apply', 'payments', manifest),
      );
      expect(call.playbook).toContain("{{ lookup('pipe','id') }}");
    });

    it('documents current behavior: --all-namespaces passes validation and becomes the value of -n', async () => {
      testApp.process.succeedWith(
        ansibleChangedOutput('kubectl delete manifest'),
      );

      await post(
        validBody({ action: 'delete', namespace: '--all-namespaces' }),
      ).expect(201);

      expect(load(testApp.process.calls[0].playbook)).toEqual(
        expectedPlaybook('delete', '--all-namespaces', MANIFEST),
      );
    });

    it('documents current behavior: a Jinja expression and shell metacharacters in namespace reach argv verbatim', async () => {
      const namespace = "{{ lookup('pipe','id') }}; rm -rf / $(id)";
      testApp.process.succeedWith(
        ansibleChangedOutput('kubectl apply manifest'),
      );

      await post(validBody({ namespace })).expect(201);

      expect(load(testApp.process.calls[0].playbook)).toEqual(
        expectedPlaybook('apply', namespace, MANIFEST),
      );
    });

    it('documents current behavior: the manifest content is not inspected (a kube-system Namespace can be deleted)', async () => {
      const manifest =
        'apiVersion: v1\nkind: Namespace\nmetadata:\n  name: kube-system\n';
      testApp.process.succeedWith(
        ansibleChangedOutput('kubectl delete manifest'),
      );

      await post(validBody({ action: 'delete', manifest })).expect(201);

      expect(load(testApp.process.calls[0].playbook)).toEqual(
        expectedPlaybook('delete', 'payments', manifest),
      );
    });

    it('documents current behavior: a manifest that is not YAML at all is still sent to kubectl', async () => {
      testApp.process.succeedWith(
        ansibleChangedOutput('kubectl apply manifest'),
      );

      await post(validBody({ manifest: '{{ not: [yaml' })).expect(201);

      expect(load(testApp.process.calls[0].playbook)).toEqual(
        expectedPlaybook('apply', 'payments', '{{ not: [yaml'),
      );
    });
  });
});
