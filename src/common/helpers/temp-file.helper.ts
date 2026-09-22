import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export interface TempFilePath {
  tempDir: string;
  filePath: string;
}

export async function createTempFile(
  dirPrefix: string,
  fileName: string,
  content: string,
  mode?: number,
): Promise<TempFilePath> {
  const tempDirPrefix = join(tmpdir(), dirPrefix);
  const tempDir = await mkdtemp(tempDirPrefix);
  const filePath = join(tempDir, fileName);
  await writeFile(filePath, content, { encoding: 'utf8', mode });
  return { tempDir, filePath };
}
