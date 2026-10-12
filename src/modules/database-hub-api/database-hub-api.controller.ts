import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { OperationResult } from '../../common/dto/operation-result.dto';
import { Roles } from '../../common/guards/roles.decorator';
import { Role } from '../../common/roles/role.enum';
import { DatabaseHubApiService } from './database-hub-api.service';
import {
  CreateDatabaseDto,
  ListDatabasesDto,
  ListDatabasesResponse,
  ManageDatabaseDto,
} from './database-hub-api.dto';
import {
  ApiCreateDatabase,
  ApiListDatabases,
  ApiManageDatabase,
} from './swagger/database-hub-api.swagger';

@ApiTags('Database Hub')
@Controller('database-hub-api')
export class DatabaseHubApiController {
  constructor(
    private readonly databaseHubApiService: DatabaseHubApiService,
  ) {}

  @Get('list-databases')
  @ApiListDatabases()
  @Roles(Role.ADMIN)
  async listDatabases(
    @Query() dto: ListDatabasesDto,
  ): Promise<ListDatabasesResponse> {
    const databases = await this.databaseHubApiService.listDatabases(dto);
    return { databases };
  }

  @Post('manage-database')
  @ApiManageDatabase()
  @Roles(Role.ADMIN)
  async manageDatabase(
    @Body() dto: ManageDatabaseDto,
  ): Promise<OperationResult> {
    return this.databaseHubApiService.manageDatabase(dto);
  }

  @Post('create-database')
  @ApiCreateDatabase()
  @Roles(Role.ADMIN)
  async createDatabase(
    @Body() dto: CreateDatabaseDto,
  ): Promise<OperationResult> {
    return this.databaseHubApiService.createDatabase(dto);
  }
}
