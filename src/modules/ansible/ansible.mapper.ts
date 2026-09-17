import { AnsiblePlaybookExecutionError } from './ansible.exception';
import { AnsibleExecutionResult } from './ansible.dto';

export class AnsibleMapper {
  static toSuccessResult(
    stdout: string,
    stderr: string,
  ): AnsibleExecutionResult {
    return { success: true, stdout, stderr, exitCode: 0 };
  }

  static toFailureResult(
    error: AnsiblePlaybookExecutionError,
  ): AnsibleExecutionResult {
    return {
      success: false,
      stdout: error.stdout,
      stderr: error.stderr,
      exitCode: error.code ?? null,
      errorMessage: error.message,
      errorCode: error.code,
    };
  }
}
