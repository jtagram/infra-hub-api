import { IsInt, IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class ManageServerDto {
  @IsNotEmpty()
  @IsInt()
  numberOfTickets!: number;

  @IsString()
  @IsNotEmpty()
  @MaxLength(20000)
  playbook!: string;
}
