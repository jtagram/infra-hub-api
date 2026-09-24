import { IsInt, IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { OperationResult, OperationResultBuilder } from '../../common/dto/operation-result.dto';

export class ManageDatabaseDto {
  @IsNotEmpty()
  @IsInt()
  numberOfTickets!: number;

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

export class DatabaseOperationResult extends OperationResult {}

export class DatabaseOperationResultBuilder extends OperationResultBuilder<DatabaseOperationResult> {
  constructor() {
    super(new DatabaseOperationResult());
  }
}
