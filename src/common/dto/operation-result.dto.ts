import { AnsibleExecutionResult } from '../../modules/ansible/ansible.service';

export class OperationResult {
  executionResult!: AnsibleExecutionResult;
  logId!: string;
}

export class OperationResultBuilder<T extends OperationResult> {
  protected readonly operationResult: T;

  constructor(instance: T) {
    this.operationResult = instance;
  }

  withExecutionResult(executionResult: AnsibleExecutionResult): this {
    this.operationResult.executionResult = executionResult;
    return this;
  }

  withLogId(logId: string): this {
    this.operationResult.logId = logId;
    return this;
  }

  build(): T {
    return this.operationResult;
  }
}
