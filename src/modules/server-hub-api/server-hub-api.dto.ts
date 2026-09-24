import { IsInt, IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { OperationResult, OperationResultBuilder } from '../../common/dto/operation-result.dto';

export class ManageServerDto {
  @IsNotEmpty()
  @IsInt()
  numberOfTickets!: number;

  @IsString()
  @IsNotEmpty()
  @MaxLength(4000)
  command!: string;
}

export class ServerOperationResult extends OperationResult {}

export class ServerOperationResultBuilder extends OperationResultBuilder<ServerOperationResult> {
  constructor() {
    super(new ServerOperationResult());
  }
}
