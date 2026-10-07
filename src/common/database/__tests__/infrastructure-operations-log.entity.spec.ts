import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from '@jest/globals';
import { DataSource, Repository } from 'typeorm';
import { createInMemoryDataSource } from '../../../../test/helpers/in-memory-db';
import {
  InfrastructureDepartment,
  InfrastructureOperationsLogEntity,
  InfrastructureOperationsLogEntityBuilder,
} from '../infrastructure-operatios-log.entity';

function buildLog(
  overrides: { department?: InfrastructureDepartment; ticket?: number } = {},
) {
  return new InfrastructureOperationsLogEntityBuilder()
    .withDepartment(overrides.department ?? InfrastructureDepartment.SERVER)
    .withNumberOfTicket(overrides.ticket ?? 42)
    .withInstruction('instruction')
    .withResponse('response')
    .build();
}

describe('InfrastructureOperationsLogEntityBuilder', () => {
  it('builds an entity with every given field', () => {
    const entity = buildLog({
      department: InfrastructureDepartment.KUBERNETES,
      ticket: 7,
    });

    expect(entity).toBeInstanceOf(InfrastructureOperationsLogEntity);
    expect(entity).toMatchObject({
      department: 'KUBERNETES',
      numberOfTicket: 7,
      instruction: 'instruction',
      response: 'response',
    });
  });

  it('leaves generated fields unset', () => {
    const entity = buildLog();

    expect(entity.id).toBeUndefined();
    expect(entity.createdAt).toBeUndefined();
    expect(entity.updatedAt).toBeUndefined();
  });

  it('chains the setters and returns the builder', () => {
    const builder = new InfrastructureOperationsLogEntityBuilder();

    expect(builder.withDepartment(InfrastructureDepartment.DATABASE)).toBe(
      builder,
    );
    expect(builder.withNumberOfTicket(1)).toBe(builder);
    expect(builder.withInstruction('i')).toBe(builder);
    expect(builder.withResponse('r')).toBe(builder);
  });
});

describe('InfrastructureDepartment', () => {
  it('has the three departments with their string values', () => {
    expect(InfrastructureDepartment).toEqual({
      DATABASE: 'DATABASE',
      KUBERNETES: 'KUBERNETES',
      SERVER: 'SERVER',
    });
  });
});

describe('InfrastructureOperationsLogEntity (in-memory db)', () => {
  let dataSource: DataSource;
  let repository: Repository<InfrastructureOperationsLogEntity>;

  beforeAll(async () => {
    dataSource = await createInMemoryDataSource([
      InfrastructureOperationsLogEntity,
    ]);
  });

  afterAll(async () => {
    await dataSource.destroy();
  });

  beforeEach(async () => {
    repository = dataSource.getRepository(InfrastructureOperationsLogEntity);
    await repository.clear();
  });

  it('is stored in the infrastructure_operations_log table', () => {
    expect(repository.metadata.tableName).toBe('infrastructure_operations_log');
  });

  it('maps the snake case column names', () => {
    const columns = repository.metadata.columns.map(
      (column) => column.databaseName,
    );

    expect(columns).toEqual(
      expect.arrayContaining(['number_of_ticket', 'created_at', 'updated_at']),
    );
  });

  it('persists a log and returns generated id and timestamps', async () => {
    const saved = await repository.save(buildLog());

    expect(saved.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(saved.createdAt).toBeInstanceOf(Date);
    expect(saved.updatedAt).toBeInstanceOf(Date);
    expect(await repository.count()).toBe(1);
  });

  it('generates a different id for each log', async () => {
    const first = await repository.save(buildLog());
    const second = await repository.save(buildLog());

    expect(second.id).not.toBe(first.id);
  });

  it('reads back what was stored', async () => {
    const saved = await repository.save(
      buildLog({ department: InfrastructureDepartment.DATABASE, ticket: 99 }),
    );

    const found = await repository.findOneByOrFail({ id: saved.id });

    expect(found).toMatchObject({
      department: InfrastructureDepartment.DATABASE,
      numberOfTicket: 99,
      instruction: 'instruction',
      response: 'response',
    });
  });

  it('stores long instruction and response texts without truncation', async () => {
    const long = 'x'.repeat(50_000);
    const log = new InfrastructureOperationsLogEntityBuilder()
      .withDepartment(InfrastructureDepartment.SERVER)
      .withNumberOfTicket(1)
      .withInstruction(long)
      .withResponse(long)
      .build();

    const saved = await repository.save(log);
    const found = await repository.findOneByOrFail({ id: saved.id });

    expect(found.instruction).toHaveLength(50_000);
    expect(found.response).toHaveLength(50_000);
  });

  it('stores text with quotes and SQL metacharacters verbatim (parameterised)', async () => {
    const hostile = `'; DROP TABLE infrastructure_operations_log; --`;
    const log = new InfrastructureOperationsLogEntityBuilder()
      .withDepartment(InfrastructureDepartment.DATABASE)
      .withNumberOfTicket(1)
      .withInstruction(hostile)
      .withResponse(hostile)
      .build();

    const saved = await repository.save(log);

    expect(
      (await repository.findOneByOrFail({ id: saved.id })).instruction,
    ).toBe(hostile);
    expect(await repository.count()).toBe(1);
  });

  it('rejects a log without department', async () => {
    const log = new InfrastructureOperationsLogEntityBuilder()
      .withNumberOfTicket(1)
      .withInstruction('i')
      .withResponse('r')
      .build();

    await expect(repository.save(log)).rejects.toThrow();
  });

  it('rejects a log without numberOfTicket', async () => {
    const log = new InfrastructureOperationsLogEntityBuilder()
      .withDepartment(InfrastructureDepartment.SERVER)
      .withInstruction('i')
      .withResponse('r')
      .build();

    await expect(repository.save(log)).rejects.toThrow();
  });

  it('rejects a log without instruction', async () => {
    const log = new InfrastructureOperationsLogEntityBuilder()
      .withDepartment(InfrastructureDepartment.SERVER)
      .withNumberOfTicket(1)
      .withResponse('r')
      .build();

    await expect(repository.save(log)).rejects.toThrow();
  });

  it('rejects a log without response', async () => {
    const log = new InfrastructureOperationsLogEntityBuilder()
      .withDepartment(InfrastructureDepartment.SERVER)
      .withNumberOfTicket(1)
      .withInstruction('i')
      .build();

    await expect(repository.save(log)).rejects.toThrow();
  });

  it('rejects a department outside the enum', async () => {
    const log = buildLog();
    log.department = 'NETWORK' as InfrastructureDepartment;

    await expect(repository.save(log)).rejects.toThrow();
    expect(await repository.count()).toBe(0);
  });

  it('filters logs by department', async () => {
    await repository.save(
      buildLog({ department: InfrastructureDepartment.SERVER }),
    );
    await repository.save(
      buildLog({ department: InfrastructureDepartment.DATABASE }),
    );

    const found = await repository.findBy({
      department: InfrastructureDepartment.DATABASE,
    });

    expect(found).toHaveLength(1);
  });

  it('filters logs by ticket number', async () => {
    await repository.save(buildLog({ ticket: 1 }));
    await repository.save(buildLog({ ticket: 2 }));

    const found = await repository.findBy({ numberOfTicket: 2 });

    expect(found).toHaveLength(1);
    expect(found[0].numberOfTicket).toBe(2);
  });
});
