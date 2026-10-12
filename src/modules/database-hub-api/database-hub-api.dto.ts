import { ApiProperty } from '@nestjs/swagger';
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
  @ApiProperty({
    description: 'Number of the ticket that requested this operation.',
    example: 1234,
    type: 'integer',
  })
  @IsNotEmpty()
  @IsInt()
  numberOfTickets!: number;

  @ApiProperty({
    description: 'Kubernetes namespace where the Postgres deployment runs.',
    example: 'production',
    maxLength: 63,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(63)
  namespace!: string;

  @ApiProperty({
    description: 'Name of the Postgres deployment that executes the SQL.',
    example: 'postgres',
    maxLength: 63,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(63)
  deployment!: string;

  @ApiProperty({
    description: 'Name of the database the SQL code runs against.',
    example: 'tickets',
    maxLength: 63,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(63)
  dbName!: string;

  @ApiProperty({
    description: 'SQL code to execute in the database.',
    example: 'SELECT count(*) FROM tickets;',
    maxLength: 5000,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(5000)
  sqlCode!: string;
}

export class CreateDatabaseDto {
  @ApiProperty({
    description: 'Number of the ticket that requested this operation.',
    example: 1234,
    type: 'integer',
  })
  @IsNotEmpty()
  @IsInt()
  numberOfTickets!: number;

  @ApiProperty({
    description: 'Kubernetes namespace where the Postgres deployment runs.',
    example: 'production',
    maxLength: 63,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(63)
  namespace!: string;

  @ApiProperty({
    description: 'Name of the Postgres deployment that creates the database.',
    example: 'postgres',
    maxLength: 63,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(63)
  deployment!: string;

  @ApiProperty({
    description:
      'Name of the database to create (lowercase Postgres identifier).',
    example: 'billing_db',
    maxLength: 63,
    pattern: '^[a-z_][a-z0-9_]*$',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(63)
  @Matches(POSTGRES_IDENTIFIER_PATTERN, { message: POSTGRES_IDENTIFIER_MESSAGE })
  dbName!: string;
}

export class ListDatabasesDto {
  @ApiProperty({
    description: 'Kubernetes namespace where the Postgres deployment runs.',
    example: 'production',
    maxLength: 63,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(63)
  namespace!: string;

  @ApiProperty({
    description: 'Name of the Postgres deployment whose databases are listed.',
    example: 'postgres',
    maxLength: 63,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(63)
  deployment!: string;
}

/** Documentation-only shape of the `GET list-databases` response. */
export class ListDatabasesResponse {
  @ApiProperty({
    description: 'Names of the databases found in the deployment.',
    type: [String],
    example: ['postgres', 'tickets'],
  })
  databases!: string[];
}
