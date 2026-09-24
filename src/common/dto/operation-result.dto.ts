import { AnsibleExecutionResult } from '../../modules/ansible/ansible.service';

export class OperationResult {
  executionResult!: AnsibleExecutionResult;
  logId!: string;
}

export class OperationResultBuilder {
  private readonly operationResult = new OperationResult();

  withExecutionResult(executionResult: AnsibleExecutionResult): this {
    this.operationResult.executionResult = executionResult;
    return this;
  }

  withLogId(logId: string): this {
    this.operationResult.logId = logId;
    return this;
  }

  build(): OperationResult {
    return this.operationResult;
  }
}
