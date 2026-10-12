import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class AnsibleExecutionResult {
  @ApiProperty({
    description: 'Whether `ansible-playbook` finished with exit code 0.',
    example: true,
  })
  success!: boolean;

  @ApiProperty({
    description: 'Standard output of `ansible-playbook`.',
    example: 'PLAY RECAP *****\nlocalhost : ok=1 changed=1 failed=0',
  })
  stdout!: string;

  @ApiProperty({
    description: 'Standard error of `ansible-playbook`.',
    example: '',
  })
  stderr!: string;

  @ApiProperty({
    description:
      'Process exit code (`0` on success). It can be a number, a string such as `ETIMEDOUT`, or `null` when unknown.',
    oneOf: [{ type: 'number' }, { type: 'string' }],
    nullable: true,
    example: 0,
  })
  exitCode!: number | string | null;

  @ApiPropertyOptional({
    description: 'Error message of the failed execution. Only set on failure.',
    example: 'Command failed: ansible-playbook ...',
  })
  errorMessage?: string;

  @ApiPropertyOptional({
    description:
      'Error code of the failed execution. Only set on failure; it can be a number, a string or `null`.',
    oneOf: [{ type: 'number' }, { type: 'string' }],
    nullable: true,
    example: 2,
  })
  errorCode?: string | number | null;
}
