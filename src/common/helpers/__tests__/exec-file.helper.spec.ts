import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { execFile } from 'node:child_process';
import { ExecFileError, execFileAsync } from '../exec-file.helper';

// Safety: no real process may ever be spawned by these tests.
jest.mock('node:child_process', () => ({ execFile: jest.fn() }));

type ExecCallback = (
  error: (Error & { code?: string | number }) | null,
  stdout: string,
  stderr: string,
) => void;

const execFileMock = execFile as unknown as jest.Mock;

describe('execFileAsync', () => {
  beforeEach(() => {
    execFileMock.mockReset();
  });

  it('spawns the command with the given args and options, without a shell', async () => {
    execFileMock.mockImplementation(((...params: unknown[]) =>
      (params[3] as ExecCallback)(null, 'out', '')) as never);

    await execFileAsync('ansible-playbook', ['-i', 'host,', '; rm -rf /'], {
      timeout: 1000,
    });

    expect(execFileMock).toHaveBeenCalledTimes(1);
    expect(execFileMock).toHaveBeenCalledWith(
      'ansible-playbook',
      ['-i', 'host,', '; rm -rf /'],
      { timeout: 1000 },
      expect.any(Function),
    );
    const options = execFileMock.mock.calls[0][2] as Record<string, unknown>;
    expect(options).not.toHaveProperty('shell');
  });

  it('resolves with stdout and stderr on success', async () => {
    execFileMock.mockImplementation(((...params: unknown[]) =>
      (params[3] as ExecCallback)(null, 'the stdout', 'the stderr')) as never);

    await expect(execFileAsync('cmd', [], { timeout: 1 })).resolves.toEqual({
      stdout: 'the stdout',
      stderr: 'the stderr',
    });
  });

  it('rejects with an ExecFileError carrying message, code, stdout and stderr', async () => {
    const failure = Object.assign(new Error('Command failed: cmd'), {
      code: 2,
    });
    execFileMock.mockImplementation(((...params: unknown[]) =>
      (params[3] as ExecCallback)(
        failure,
        'partial out',
        'partial err',
      )) as never);

    const rejection = execFileAsync('cmd', [], { timeout: 1 });

    await expect(rejection).rejects.toBeInstanceOf(ExecFileError);
    await expect(rejection).rejects.toMatchObject({
      name: 'ExecFileError',
      message: 'Command failed: cmd',
      code: 2,
      stdout: 'partial out',
      stderr: 'partial err',
    });
  });

  it('keeps a string error code such as ENOENT', async () => {
    const failure = Object.assign(new Error('spawn cmd ENOENT'), {
      code: 'ENOENT',
    });
    execFileMock.mockImplementation(((...params: unknown[]) =>
      (params[3] as ExecCallback)(failure, '', '')) as never);

    await expect(
      execFileAsync('cmd', [], { timeout: 1 }),
    ).rejects.toMatchObject({ code: 'ENOENT' });
  });

  it('is an Error subclass', () => {
    const error = new ExecFileError('m', 1, 'o', 'e');

    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe('ExecFileError');
  });
});
