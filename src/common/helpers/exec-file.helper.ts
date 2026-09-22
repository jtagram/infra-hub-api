import { execFile } from 'node:child_process';

export interface ExecFileResult {
  stdout: string;
  stderr: string;
}

export interface ExecFileOptions {
  timeout: number;
}

export class ExecFileError extends Error {
  constructor(
    message: string,
    public readonly code: string | number | null | undefined,
    public readonly stdout: string,
    public readonly stderr: string,
  ) {
    super(message);
    this.name = 'ExecFileError';
  }
}

export function execFileAsync(
  command: string,
  args: string[],
  options: ExecFileOptions,
): Promise<ExecFileResult> {
  return new Promise((resolve, reject) => {
    execFile(command, args, options, (error, stdout, stderr) => {
      if (error) {
        reject(new ExecFileError(error.message, error.code, stdout, stderr));
        return;
      }
      resolve({ stdout, stderr });
    });
  });
}
