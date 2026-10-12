import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import {
  HealthCheck,
  HealthCheckService,
  TypeOrmHealthIndicator,
} from '@nestjs/terminus';
import { Public } from '../../common/guards/public.decorator';
import { ApiGetHealth } from './swagger/health.swagger';

@ApiTags('Health')
@Controller('health')
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly database: TypeOrmHealthIndicator,
  ) {}

  @Get()
  @Public()
  @HealthCheck()
  @ApiGetHealth()
  check() {
    return this.health.check([() => this.database.pingCheck('database')]);
  }
}
