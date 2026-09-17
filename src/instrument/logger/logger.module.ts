import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LoggerModule as PinoLoggerModule } from 'nestjs-pino';
import { buildLoggerOptions } from './logger.config';

@Global()
@Module({
  imports: [
    PinoLoggerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) =>
        buildLoggerOptions(configService.get<string>('LOG_LEVEL')!),
    }),
  ],
  exports: [PinoLoggerModule],
})
export class LoggerModule {}
