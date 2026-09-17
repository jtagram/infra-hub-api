import { plainToInstance } from 'class-transformer';
import {
  IsNotEmpty,
  IsNumberString,
  IsString,
  validateSync,
} from 'class-validator';

export class EnvironmentVariables {
  @IsString()
  @IsNotEmpty()
  SERVER_SSH_HOST!: string;

  @IsString()
  @IsNotEmpty()
  SERVER_SSH_USER!: string;

  @IsNumberString()
  PORT!: string;
}

export function validate(
  config: Record<string, unknown>,
): EnvironmentVariables {
  const validatedConfig = plainToInstance(EnvironmentVariables, config);

  const errors = validateSync(validatedConfig, {
    skipMissingProperties: false,
  });

  if (errors.length > 0) {
    const invalid = errors.map((error) => error.property).join(', ');
    throw new Error(`Missing required environment variable(s): ${invalid}`);
  }

  return validatedConfig;
}
