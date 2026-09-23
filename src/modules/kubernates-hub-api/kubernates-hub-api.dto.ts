import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsString,
  MaxLength,
} from 'class-validator';
import { InfrastructureDepartment } from '../../common/database/infrastructure-operatios-log.entity';
import { AnsibleExecutionResult } from '../ansible/ansible.service';
import { KubernetesAction } from './kubernates-hub-api.playbook';

export class ManageKubernetesDto {
  @IsNotEmpty()
  @IsInt()
  numberOfTickets!: number;

  @IsEnum(InfrastructureDepartment)
  department!: InfrastructureDepartment;

  @IsString()
  @IsNotEmpty()
  @MaxLength(63)
  namespace!: string;

  @IsEnum(KubernetesAction)
  action!: KubernetesAction;

  @IsString()
  @IsNotEmpty()
  @MaxLength(20000)
  manifest!: string;
}

export class ManageKubernetesServerDto {
  @IsNotEmpty()
  @IsInt()
  numberOfTickets!: number;

  @IsEnum(InfrastructureDepartment)
  department!: InfrastructureDepartment;

  @IsString()
  @IsNotEmpty()
  @MaxLength(4000)
  command!: string;
}

export class KubernetesOperationResult {
  executionResult!: AnsibleExecutionResult;
  logId!: string;
}

export class KubernetesOperationResultBuilder {
  private readonly kubernetesOperationResult = new KubernetesOperationResult();

  withExecutionResult(executionResult: AnsibleExecutionResult): this {
    this.kubernetesOperationResult.executionResult = executionResult;
    return this;
  }

  withLogId(logId: string): this {
    this.kubernetesOperationResult.logId = logId;
    return this;
  }

  build(): KubernetesOperationResult {
    return this.kubernetesOperationResult;
  }
}
