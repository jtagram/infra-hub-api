export interface AnsibleExecutionResult {
  success: boolean;
  stdout: string;
  stderr: string;
  exitCode: number | string | null;
  errorMessage?: string;
  errorCode?: string | number | null;
}
