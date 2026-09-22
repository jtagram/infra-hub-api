import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModule, TypeOrmModuleOptions } from '@nestjs/typeorm';
import { InfrastructureOperationsLogEntity } from './infrastructure-operatios-log.entity';

@Global()
@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      useFactory: (configService: ConfigService): TypeOrmModuleOptions => ({
        type: 'postgres',
        host: configService.get<string>('DB_HOST'),
        port: Number(configService.get<string>('DB_PORT')),
        username: configService.get<string>('DB_USERNAME'),
        password: configService.get<string>('DB_PASSWORD'),
        database: configService.get<string>('DB_NAME'),
        entities: [InfrastructureOperationsLogEntity],
        synchronize: false,
      }),
      inject: [ConfigService],
    }),
    TypeOrmModule.forFeature([InfrastructureOperationsLogEntity]),
  ],
  exports: [TypeOrmModule],
})
export class DatabaseModule {}
