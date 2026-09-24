import { IsEnum, IsInt, IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { OperationResult, OperationResultBuilder } from '../../common/dto/operation-result.dto';
import { KubernetesAction } from './kubernates-hub-api.playbook';

export class ManageKubernetesDto {
  @IsNotEmpty()
  @IsInt()
  numberOfTickets!: number;

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

  @IsString()
  @IsNotEmpty()
  @MaxLength(4000)
  command!: string;
}

export class KubernetesOperationResult extends OperationResult {}

export class KubernetesOperationResultBuilder extends OperationResultBuilder<KubernetesOperationResult> {
  constructor() {
    super(new KubernetesOperationResult());
  }
}
