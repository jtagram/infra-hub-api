import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class ManageServerDto {
  @ApiProperty({
    description: 'Number of the ticket that requested this operation.',
    example: 1234,
    type: 'integer',
  })
  @IsNotEmpty()
  @IsInt()
  numberOfTickets!: number;

  @ApiProperty({
    description:
      'Ansible playbook as YAML text. It must be a YAML list of plays.',
    example:
      '- hosts: all\n  gather_facts: false\n  tasks:\n    - name: Check uptime\n      ansible.builtin.command: uptime',
    maxLength: 20000,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(20000)
  playbook!: string;
}
