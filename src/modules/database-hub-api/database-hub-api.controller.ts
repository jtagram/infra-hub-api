import { Body, Controller, Post } from '@nestjs/common';
import { OperationResult } from '../../common/dto/operation-result.dto';
import { DatabaseHubApiService } from './database-hub-api.service';
import { ManageDatabaseDto } from './database-hub-api.dto';

@Controller('database-hub-api')
export class DatabaseHubApiController {
  constructor(
    private readonly databaseHubApiService: DatabaseHubApiService,
  ) {}

  @Post('manage-database')
  async manageDatabase(
    @Body() dto: ManageDatabaseDto,
  ): Promise<OperationResult> {
    return this.databaseHubApiService.manageDatabase(dto);
  }
}
