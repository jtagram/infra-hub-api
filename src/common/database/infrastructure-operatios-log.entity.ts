import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum InfrastructureDepartment {
  DATABASE = 'DATABASE',
  KUBERNETES = 'KUBERNETES',
  SERVER = 'SERVER',
}

@Entity('infrastructure_operations_log')
export class InfrastructureOperationsLogEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'enum', enum: InfrastructureDepartment })
  department!: InfrastructureDepartment;

  @Column({ name: 'number_of_ticket' })
  numberOfTicket!: number;

  @Column('text')
  instruction!: string;

  @Column('text')
  response!: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}

export class InfrastructureOperationsLogEntityBuilder {
  private readonly entity = new InfrastructureOperationsLogEntity();

  withDepartment(department: InfrastructureDepartment): this {
    this.entity.department = department;
    return this;
  }

  withNumberOfTicket(numberOfTicket: number): this {
    this.entity.numberOfTicket = numberOfTicket;
    return this;
  }

  withInstruction(instruction: string): this {
    this.entity.instruction = instruction;
    return this;
  }

  withResponse(response: string): this {
    this.entity.response = response;
    return this;
  }

  build(): InfrastructureOperationsLogEntity {
    return this.entity;
  }
}
