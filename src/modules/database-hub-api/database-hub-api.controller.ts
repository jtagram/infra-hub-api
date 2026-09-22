import { Body, Controller, Post } from '@nestjs/common';
import { DatabaseHubApiService } from './database-hub-api.service';
import { DatabaseOperationResult, ManageDatabaseDto } from './database-hub-api.dto';

@Controller('database-hub-api')
export class DatabaseHubApiController {
  constructor(
    private readonly databaseHubApiService: DatabaseHubApiService,
  ) {}

  @Post()
  async manageDatabase(
    @Body() dto: ManageDatabaseDto,
  ): Promise<DatabaseOperationResult> {
    return this.databaseHubApiService.manageDatabase(dto);
  }
}
