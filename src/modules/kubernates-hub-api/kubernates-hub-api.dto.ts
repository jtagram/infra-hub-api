import { IsEnum, IsInt, IsNotEmpty, IsString, MaxLength } from 'class-validator';
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
