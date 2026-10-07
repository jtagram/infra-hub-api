import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from '@jest/globals';
import { InfrastructureDepartment } from '../src/common/database/infrastructure-operatios-log.entity';
import { AppTestApp, createAppTestApp } from './helpers/app-test-app';
import { ansibleDebugOutput } from './helpers/ansible-output';
import {
  ADMIN_AUTHORIZATION,
  authorizationHeaderFor,
  hs256ConfusionAdminAuthorizationHeader,
} from './helpers/test-auth';

// Smoke suite: the REAL AppModule (see helpers/app-test-app.ts for what is
// stubbed). Per-endpoint behavior is covered by the module-level e2e suites.
describe('AppModule (e2e smoke)', () => {
  let testApp: AppTestApp;

  beforeAll(async () => {
    testApp = await createAppTestApp();
  });

  beforeEach(async () => {
    await testApp.resetState();
  });

  afterEach(() => {
    testApp.assertNoRealProcess();
  });

  afterAll(async () => {
    await testApp.close();
  });

  it('downloaded the JWKS from iam-api while booting the real module', () => {
    expect(testApp.fetchSpy).toHaveBeenCalledWith(
      'http://iam-api.test/.well-known/jwks.json',
    );
  });

  it('GET / returns Hello World without a token (public route)', async () => {
    const response = await testApp.http().get('/').expect(200);

    expect(response.text).toBe('Hello World!');
  });

  it('returns 404 for an unknown route', async () => {
    await testApp
      .http()
      .get('/does-not-exist')
      .set('Authorization', ADMIN_AUTHORIZATION)
      .expect(404);
  });

  it('returns 401 on a protected route without a token', async () => {
    const response = await testApp
      .http()
      .get('/kubernates-hub-api/list-deployments')
      .query({ namespace: 'payments' })
      .expect(401);

    expect(response.body.message).toBe('Missing or malformed bearer token');
    expect(testApp.process.calls).toEqual([]);
  });

  it('returns 401 for an HS256 token keyed with the public key (algorithm confusion)', async () => {
    const response = await testApp
      .http()
      .get('/kubernates-hub-api/list-deployments')
      .query({ namespace: 'payments' })
      .set('Authorization', hs256ConfusionAdminAuthorizationHeader())
      .expect(401);

    expect(response.body.message).toBe('Invalid or expired token');
    expect(testApp.process.calls).toEqual([]);
  });

  it('returns 403 when the token belongs to another application', async () => {
    await testApp
      .http()
      .get('/kubernates-hub-api/list-deployments')
      .query({ namespace: 'payments' })
      .set(
        'Authorization',
        authorizationHeaderFor({
          email: 'admin@example.com',
          roles: ['ADMIN'],
          applicationName: 'some-other-app',
        }),
      )
      .expect(403);
    expect(testApp.process.calls).toEqual([]);
  });

  it('applies the global ValidationPipe (400 on unknown query properties)', async () => {
    const response = await testApp
      .http()
      .get('/kubernates-hub-api/list-deployments')
      .query({ namespace: 'payments', extra: '1' })
      .set('Authorization', ADMIN_AUTHORIZATION)
      .expect(400);

    expect(response.body.message).toEqual(['property extra should not exist']);
    expect(testApp.process.calls).toEqual([]);
  });

  it('serves a read-only operation through guards, service, playbook builder and the process stub', async () => {
    testApp.process.succeedWith(
      ansibleDebugOutput('List deployments in namespace', 'api worker'),
    );

    const response = await testApp
      .http()
      .get('/kubernates-hub-api/list-deployments')
      .query({ namespace: 'payments' })
      .set('Authorization', ADMIN_AUTHORIZATION)
      .expect(200);

    expect(response.body).toEqual({ deployments: ['api', 'worker'] });
    expect(testApp.process.calls).toHaveLength(1);
    expect(testApp.process.calls[0].command).toBe('ansible-playbook');
  });

  it('runs a mutating operation and persists the operations log in pg-mem', async () => {
    testApp.process.succeedWith('PLAY RECAP: ok=1');

    const response = await testApp
      .http()
      .post('/server-hub-api/manage-server')
      .set('Authorization', ADMIN_AUTHORIZATION)
      .send({ numberOfTickets: 7, playbook: '- hosts: all\n  tasks: []\n' })
      .expect(201);

    const rows = await testApp.logRows();
    expect(rows).toHaveLength(1);
    expect(rows[0].id).toBe(response.body.logId);
    expect(rows[0].department).toBe(InfrastructureDepartment.SERVER);
    expect(rows[0].numberOfTicket).toBe(7);
    expect(testApp.process.calls).toHaveLength(1);
    expect(testApp.leftoverTempEntries()).toEqual([]);
  });
});
