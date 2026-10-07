import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { createTempFile } from '../temp-file.helper';

// Safety: nothing may be written to the real file system.
jest.mock('node:fs/promises', () => ({
  mkdtemp: jest.fn(),
  writeFile: jest.fn(),
}));
jest.mock('node:os', () => ({ tmpdir: () => '/fake-tmp' }));

const mkdtempMock = mkdtemp as unknown as jest.Mock<
  (prefix: string) => Promise<string>
>;
const writeFileMock = writeFile as unknown as jest.Mock<
  (...args: unknown[]) => Promise<void>
>;

describe('createTempFile', () => {
  beforeEach(() => {
    mkdtempMock.mockReset();
    writeFileMock.mockReset();
    mkdtempMock.mockResolvedValue('/fake-tmp/pcbox-playbook-AbC123');
    writeFileMock.mockResolvedValue(undefined);
  });

  it('creates the temp directory under the OS tmpdir with the given prefix', async () => {
    await createTempFile('pcbox-playbook-', 'playbook.yml', 'content');

    expect(mkdtempMock).toHaveBeenCalledWith('/fake-tmp/pcbox-playbook-');
  });

  it('writes the content as utf8 inside the created directory', async () => {
    await createTempFile('pcbox-playbook-', 'playbook.yml', 'the content');

    expect(writeFileMock).toHaveBeenCalledWith(
      '/fake-tmp/pcbox-playbook-AbC123/playbook.yml',
      'the content',
      { encoding: 'utf8', mode: undefined },
    );
  });

  it('passes the file mode when one is given', async () => {
    await createTempFile('pcbox-ssh-key-', 'key', 'secret', 0o600);

    expect(writeFileMock).toHaveBeenCalledWith(expect.any(String), 'secret', {
      encoding: 'utf8',
      mode: 0o600,
    });
  });

  it('returns the directory and the file path', async () => {
    await expect(
      createTempFile('pcbox-playbook-', 'playbook.yml', 'content'),
    ).resolves.toEqual({
      tempDir: '/fake-tmp/pcbox-playbook-AbC123',
      filePath: '/fake-tmp/pcbox-playbook-AbC123/playbook.yml',
    });
  });

  it('does not write anything when the directory cannot be created', async () => {
    mkdtempMock.mockRejectedValue(new Error('EACCES'));

    await expect(createTempFile('p-', 'f', 'c')).rejects.toThrow('EACCES');

    expect(writeFileMock).not.toHaveBeenCalled();
  });

  it('propagates a write failure', async () => {
    writeFileMock.mockRejectedValue(new Error('ENOSPC'));

    await expect(createTempFile('p-', 'f', 'c')).rejects.toThrow('ENOSPC');
  });
});
