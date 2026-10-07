import { randomUUID } from 'node:crypto';
import { DataType, newDb } from 'pg-mem';
import { DataSource, EntityTarget } from 'typeorm';

export async function createInMemoryDataSource(
  entities: EntityTarget<unknown>[],
): Promise<DataSource> {
  const db = newDb({ autoCreateForeignKeyIndices: true });

  db.public.registerFunction({
    name: 'current_database',
    returns: DataType.text,
    implementation: () => 'test',
  });
  db.public.registerFunction({
    name: 'version',
    returns: DataType.text,
    implementation: () => 'PostgreSQL 16.0 (pg-mem)',
  });

  // `@PrimaryGeneratedColumn('uuid')` defaults to uuid_generate_v4() on Postgres.
  db.public.registerFunction({
    name: 'uuid_generate_v4',
    returns: DataType.uuid,
    implementation: () => randomUUID(),
    impure: true,
  });

  // Used by TypeORM's schema introspection during synchronize().
  db.public.registerFunction({
    name: 'quote_ident',
    args: [DataType.text],
    returns: DataType.text,
    implementation: (value: string) => value,
  });
  db.public.registerFunction({
    name: 'obj_description',
    args: [DataType.regclass, DataType.text],
    returns: DataType.text,
    implementation: () => null,
  });

  const dataSource: DataSource = await db.adapters.createTypeormDataSource({
    type: 'postgres',
    entities,
    synchronize: false,
  });

  await dataSource.initialize();
  await dataSource.synchronize();

  return dataSource;
}
