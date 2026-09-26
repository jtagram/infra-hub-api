import {
  IsInt,
  IsNotEmpty,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';

const POSTGRES_IDENTIFIER_PATTERN = /^[a-z_][a-z0-9_]*$/;
const POSTGRES_IDENTIFIER_MESSAGE =
  'dbName must be a valid lowercase Postgres identifier';

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
  deployment!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(63)
  dbName!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(5000)
  sqlCode!: string;
}

export class CreateDatabaseDto {
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
  deployment!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(63)
  @Matches(POSTGRES_IDENTIFIER_PATTERN, { message: POSTGRES_IDENTIFIER_MESSAGE })
  dbName!: string;
}

export class ListDatabasesDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(63)
  namespace!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(63)
  deployment!: string;
}
