import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { OperationResult } from '../../common/dto/operation-result.dto';
import { DatabaseHubApiService } from './database-hub-api.service';
import {
  CreateDatabaseDto,
  ListDatabasesDto,
  ManageDatabaseDto,
} from './database-hub-api.dto';

@Controller('database-hub-api')
export class DatabaseHubApiController {
  constructor(
    private readonly databaseHubApiService: DatabaseHubApiService,
  ) {}

  @Get('list-databases')
  async listDatabases(
    @Query() dto: ListDatabasesDto,
  ): Promise<{ databases: string[] }> {
    const databases = await this.databaseHubApiService.listDatabases(dto);
    return { databases };
  }

  @Post('manage-database')
  async manageDatabase(
    @Body() dto: ManageDatabaseDto,
  ): Promise<OperationResult> {
    return this.databaseHubApiService.manageDatabase(dto);
  }

  @Post('create-database')
  async createDatabase(
    @Body() dto: CreateDatabaseDto,
  ): Promise<OperationResult> {
    return this.databaseHubApiService.createDatabase(dto);
  }
}
