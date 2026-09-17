export class AnsiblePlaybookExecutionError extends Error {
  constructor(
    message: string,
    public readonly code: string | number | null | undefined,
    public readonly stdout: string,
    public readonly stderr: string,
  ) {
    super(message);
    this.name = 'AnsiblePlaybookExecutionError';
  }
}
