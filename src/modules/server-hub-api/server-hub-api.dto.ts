import { IsInt, IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { AnsibleExecutionResult } from '../ansible/ansible.service';

export class ManageServerDto {
  @IsNotEmpty()
  @IsInt()
  numberOfTickets!: number;

  @IsString()
  @IsNotEmpty()
  @MaxLength(4000)
  command!: string;
}

export class ServerOperationResult {
  executionResult!: AnsibleExecutionResult;
  logId!: string;
}

export class ServerOperationResultBuilder {
  private readonly serverOperationResult = new ServerOperationResult();

  withExecutionResult(executionResult: AnsibleExecutionResult): this {
    this.serverOperationResult.executionResult = executionResult;
    return this;
  }

  withLogId(logId: string): this {
    this.serverOperationResult.logId = logId;
    return this;
  }

  build(): ServerOperationResult {
    return this.serverOperationResult;
  }
}
