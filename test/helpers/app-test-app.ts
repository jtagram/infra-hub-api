import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { jest } from '@jest/globals';
import { createPublicKey } from 'node:crypto';
import {
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
} from 'node:fs';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { InfrastructureOperationsLogEntity } from '../../src/common/database/infrastructure-operatios-log.entity';
import type {
  ExecFileOptions,
  ExecFileResult,
} from '../../src/common/helpers/exec-file.helper';
import { createInMemoryDataSource } from './in-memory-db';
import {
  publicKeyServiceStub,
  TEST_KEY_ID,
  TEST_APPLICATION_NAME,
} from './test-auth';

const IAM_API_URL = 'http://iam-api.test';
export const TEST_SSH_HOST = 'pcbox.test';
export const TEST_SSH_USER = 'deploy';
export const TEST_SSH_PRIVATE_KEY =
  '-----BEGIN FAKE PRIVATE KEY-----\nnot-a-real-key\n-----END FAKE PRIVATE KEY-----\n';

/** Valid values for every variable validated by src/common/config/env.validation.ts. */
const TEST_ENV: Record<string, string> = {
  PORT: '0',
  // 'silent' is not accepted by the env validation; 'fatal' is quiet enough.
  LOG_LEVEL: 'fatal',
  SERVER_SSH_HOST: TEST_SSH_HOST,
  SERVER_SSH_USER: TEST_SSH_USER,
  SERVER_SSH_PRIVATE_KEY: TEST_SSH_PRIVATE_KEY,
  DB_HOST: 'unused-pg-mem',
  DB_PORT: '5432',
  DB_USERNAME: 'test',
  DB_PASSWORD: 'test',
  DB_NAME: 'test',
  IAM_API_URL,
  INFRA_HUB_API_APPLICATION_NAME: TEST_APPLICATION_NAME,
};

/** One invocation that reached the (stubbed) process layer. */
export interface ExecCall {
  command: string;
  args: string[];
  options: ExecFileOptions;
  /** Path of the playbook (last ansible-playbook argument). */
  playbookPath: string;
  /** Content of that playbook file at the moment the process would have run. */
  playbook: string;
  sshKeyPath: string;
  /** Content of the SSH key file at the moment the process would have run. */
  sshKey: string;
  /** Permission bits (octal, e.g. 0o600) of the SSH key file. */
  sshKeyMode: number;
}

/** What an ansible-playbook invocation looks like for the configured env. */
export function expectedAnsibleArgs(call: ExecCall): string[] {
  return [
    '-i',
    `${TEST_SSH_HOST},`,
    '-u',
    TEST_SSH_USER,
    '--private-key',
    call.sshKeyPath,
    '--ssh-common-args',
    '-o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null',
    call.playbookPath,
  ];
}

export interface ProcessStub {
  /** Every call that reached `execFileAsync`, in order. */
  calls: ExecCall[];
  /** Any attempt to use `node:child_process` directly (must stay empty). */
  realProcessAttempts: string[];
  /** ansible-playbook "exits 0" with this stdout/stderr. */
  succeedWith: (stdout: string, stderr?: string) => void;
  /** ansible-playbook "exits non-zero": rejects with an ExecFileError. */
  failWith: (failure: {
    message?: string;
    code?: string | number | null;
    stdout?: string;
    stderr?: string;
  }) => void;
  /** The exec layer rejects with an arbitrary (non ExecFileError) error. */
  throwWith: (error: Error) => void;
  /** Drops recorded calls and goes back to "no behavior configured". */
  reset: () => void;
}

export interface AppTestApp {
  app: INestApplication;
  dataSource: DataSource;
  process: ProcessStub;
  /** Spy on the global `fetch` used for the JWKS download. */
  fetchSpy: ReturnType<typeof jest.spyOn>;
  /** supertest agent bound to the running app. */
  http: () => ReturnType<typeof request>;
  /** Rows of infrastructure_operations_log, oldest first. */
  logRows: () => Promise<InfrastructureOperationsLogEntity[]>;
  /** Entries left in the redirected temp dir (playbook/SSH key dirs). */
  leftoverTempEntries: () => string[];
  /** Asserts the invariants every e2e must hold (no real process spawned). */
  assertNoRealProcess: () => void;
  /** pg-mem `clear()` only deletes rows: it does not restart sequences. */
  resetState: () => Promise<void>;
  close: () => Promise<void>;
}

function snapshotCall(
  command: string,
  args: string[],
  options: ExecFileOptions,
): ExecCall {
  const playbookPath = args[args.length - 1];
  const sshKeyPath = args[args.indexOf('--private-key') + 1];
  return {
    command,
    args,
    options,
    playbookPath,
    playbook: readFileSync(playbookPath, 'utf8'),
    sshKeyPath,
    sshKey: readFileSync(sshKeyPath, 'utf8'),
    sshKeyMode: statSync(sshKeyPath).mode & 0o777,
  };
}

/**
 * Boots the REAL AppModule (EnvModule with validation, pino logger,
 * ScheduleModule, DatabaseModule/TypeOrmModule, JwtPublicKeyService, all
 * feature modules, AnsibleModule, APP_GUARD JwtAuthGuard + RolesGuard).
 *
 * Replaced edges only:
 *  - src/common/helpers/exec-file.helper `execFileAsync` -> recording stub (the
 *    only exec path); `node:child_process` itself is replaced by a guard that
 *    records and rejects any use, so a real process can never be spawned;
 *  - src/common/helpers/temp-file.helper `createTempFile` -> same code rooted in
 *    a per-app temp dir, so the playbook and the SSH key written by
 *    AnsibleService never leave it (AnsibleService still removes them itself);
 *  - the TypeORM DataSource provider -> pg-mem (the forRootAsync factory still
 *    runs with the test env, but nothing connects to Postgres);
 *  - global `fetch` for `${IAM_API_URL}/.well-known/jwks.json` -> JWKS built
 *    from the test public key (any other URL is rejected);
 *  - console.error is muted: JwtAuthGuard logs every rejected token with it.
 * process.env is set for the boot and restored on close().
 */
export async function createAppTestApp(): Promise<AppTestApp> {
  const previousEnv: Record<string, string | undefined> = {};
  const tempRoot = mkdtempSync(join(tmpdir(), 'infra-hub-e2e-'));
  for (const [key, value] of Object.entries(TEST_ENV)) {
    previousEnv[key] = process.env[key];
    process.env[key] = value;
  }

  const consoleErrorSpy = jest
    .spyOn(console, 'error')
    .mockImplementation(() => undefined);

  const publicKeyPem = (await publicKeyServiceStub.getPublicKey(TEST_KEY_ID))!;
  const jwk = createPublicKey(publicKeyPem).export({ format: 'jwk' });
  const fetchSpy = jest
    .spyOn(globalThis, 'fetch')
    .mockImplementation(async (input) => {
      const url = typeof input === 'string' ? input : String(input);
      if (url === `${IAM_API_URL}/.well-known/jwks.json`) {
        return new Response(
          JSON.stringify({ keys: [{ ...jwk, kid: TEST_KEY_ID }] }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        );
      }
      throw new Error(`Unexpected outbound HTTP call in e2e: ${url}`);
    });

  // ---- process layer ------------------------------------------------------
  const calls: ExecCall[] = [];
  const realProcessAttempts: string[] = [];
  type Behavior = (command: string, args: string[]) => Promise<ExecFileResult>;
  const noBehavior: Behavior = async () => {
    throw new Error('e2e: no process stub behavior configured for this test');
  };
  let behavior: Behavior = noBehavior;

  const childProcessGuard = (name: string) => () => {
    realProcessAttempts.push(name);
    throw new Error(`e2e: node:child_process.${name} must never be used`);
  };
  jest.unstable_mockModule('node:child_process', () => ({
    execFile: childProcessGuard('execFile'),
    exec: childProcessGuard('exec'),
    spawn: childProcessGuard('spawn'),
    fork: childProcessGuard('fork'),
    execSync: childProcessGuard('execSync'),
    execFileSync: childProcessGuard('execFileSync'),
    spawnSync: childProcessGuard('spawnSync'),
  }));

  // Specifiers are variables so tsc (nodenext) does not demand file
  // extensions; ts-jest/ESM resolves them at runtime.
  const execHelperPath = '../../src/common/helpers/exec-file.helper';
  const actualExecHelper = (await import(
    execHelperPath
  )) as typeof import('../../src/common/helpers/exec-file.helper');
  const execFileAsyncStub = async (
    command: string,
    args: string[],
    options: ExecFileOptions,
  ): Promise<ExecFileResult> => {
    calls.push(snapshotCall(command, args, options));
    return behavior(command, args);
  };
  jest.unstable_mockModule(execHelperPath, () => ({
    ...actualExecHelper,
    execFileAsync: execFileAsyncStub,
  }));

  // TMPDIR cannot be used to redirect os.tmpdir(): jest hands the tests a
  // sandboxed copy of process.env. The temp-file helper is replaced by the same
  // implementation rooted in the per-app temp dir instead.
  jest.unstable_mockModule('../../src/common/helpers/temp-file.helper', () => ({
    createTempFile: async (
      dirPrefix: string,
      fileName: string,
      content: string,
      mode?: number,
    ) => {
      const tempDir = await mkdtemp(join(tempRoot, dirPrefix));
      const filePath = join(tempDir, fileName);
      await writeFile(filePath, content, { encoding: 'utf8', mode });
      return { tempDir, filePath };
    },
  }));

  const processStub: ProcessStub = {
    calls,
    realProcessAttempts,
    succeedWith: (stdout, stderr = '') => {
      behavior = async () => ({ stdout, stderr });
    },
    failWith: ({
      message = 'Command failed: ansible-playbook',
      code = 2,
      stdout = '',
      stderr = '',
    }) => {
      behavior = async () => {
        throw new actualExecHelper.ExecFileError(message, code, stdout, stderr);
      };
    },
    throwWith: (error) => {
      behavior = async () => {
        throw error;
      };
    },
    reset: () => {
      calls.length = 0;
      realProcessAttempts.length = 0;
      behavior = noBehavior;
    },
  };

  const dataSource = await createInMemoryDataSource([
    InfrastructureOperationsLogEntity,
  ]);

  const restore = () => {
    fetchSpy.mockRestore();
    consoleErrorSpy.mockRestore();
    for (const [key, value] of Object.entries(previousEnv)) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
    rmSync(tempRoot, { recursive: true, force: true });
  };

  try {
    // Imported lazily: EnvModule calls ConfigModule.forRoot({ validate }) while
    // the module file is evaluated, so the env (and the mocks above) must
    // already be in place by then.
    const appModulePath = '../../src/app.module';
    const { AppModule } = (await import(
      appModulePath
    )) as typeof import('../../src/app.module');
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(DataSource)
      .useValue(dataSource)
      .compile();

    const app = moduleRef.createNestApplication({ logger: false });
    // Exactly the global pipe configured in src/main.ts (outside AppModule).
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();

    return {
      app,
      dataSource,
      process: processStub,
      fetchSpy,
      http: () => request(app.getHttpServer()),
      logRows: () =>
        dataSource
          .getRepository(InfrastructureOperationsLogEntity)
          .find({ order: { createdAt: 'ASC' } }),
      leftoverTempEntries: () => readdirSync(tempRoot),
      assertNoRealProcess: () => {
        if (realProcessAttempts.length > 0) {
          throw new Error(
            `node:child_process was used: ${realProcessAttempts.join(', ')}`,
          );
        }
        for (const call of calls) {
          if (call.command !== 'ansible-playbook') {
            throw new Error(`Unexpected command: ${call.command}`);
          }
          if (!call.playbookPath.startsWith(tempRoot)) {
            throw new Error(
              `Playbook written outside temp: ${call.playbookPath}`,
            );
          }
          if (!call.sshKeyPath.startsWith(tempRoot)) {
            throw new Error(`SSH key written outside temp: ${call.sshKeyPath}`);
          }
        }
      },
      resetState: async () => {
        processStub.reset();
        await dataSource
          .getRepository(InfrastructureOperationsLogEntity)
          .clear();
      },
      close: async () => {
        await app.close();
        if (dataSource.isInitialized) {
          await dataSource.destroy();
        }
        restore();
      },
    };
  } catch (error) {
    restore();
    throw error;
  }
}
