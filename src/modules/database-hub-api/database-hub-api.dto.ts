import { IsEnum, IsInt, IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { InfrastructureDepartment } from '../../common/database/infrastructure-operatios-log.entity';
import { AnsibleExecutionResult } from '../ansible/ansible.service';

export class ManageDatabaseDto {
  @IsNotEmpty()
  @IsInt()
  numberOfTickets!: number;

  @IsEnum(InfrastructureDepartment)
  department!: InfrastructureDepartment;

  @IsString()
  @IsNotEmpty()
  @MaxLength(63)
  namespace!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(63)
  dbName!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(5000)
  sqlCode!: string;
}

export class DatabaseOperationResult {
  executionResult!: AnsibleExecutionResult;
  logId!: string;
}

export class DatabaseOperationResultBuilder {
  private readonly databaseOperationResult = new DatabaseOperationResult();

  withExecutionResult(executionResult: AnsibleExecutionResult): this {
    this.databaseOperationResult.executionResult = executionResult;
    return this;
  }

  withLogId(logId: string): this {
    this.databaseOperationResult.logId = logId;
    return this;
  }

  build(): DatabaseOperationResult {
    return this.databaseOperationResult;
  }
}
