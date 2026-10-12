import { ApiProperty } from '@nestjs/swagger';
import { AnsibleExecutionResult } from '../../modules/ansible/ansible.dto';

export class OperationResult {
  @ApiProperty({
    description:
      'Outcome of the Ansible execution. A failed playbook is still reported here (`success: false`) with HTTP 201.',
    type: AnsibleExecutionResult,
  })
  executionResult!: AnsibleExecutionResult;

  @ApiProperty({
    description: 'Identifier of the infrastructure operation log entry.',
    format: 'uuid',
    example: '3f8e1c52-7a4b-4d0e-9c1a-5b6d7e8f9a0b',
  })
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
