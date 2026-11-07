import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { OperationResult } from '../../common/dto/operation-result.dto';
import { ResponseBody } from '../../common/dto/response-body.dto';
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
	constructor(private readonly databaseHubApiService: DatabaseHubApiService) {}

	@Get('list-databases')
	@ApiListDatabases()
	@Roles(Role.ADMIN)
	listDatabases(@Query() dto: ListDatabasesDto): Promise<ResponseBody<ListDatabasesResponse>> {
		return this.databaseHubApiService.listDatabases(dto);
	}

	@Post('manage-database')
	@ApiManageDatabase()
	@Roles(Role.ADMIN)
	manageDatabase(@Body() dto: ManageDatabaseDto): Promise<ResponseBody<OperationResult>> {
		return this.databaseHubApiService.manageDatabase(dto);
	}

	@Post('create-database')
	@ApiCreateDatabase()
	@Roles(Role.ADMIN)
	createDatabase(@Body() dto: CreateDatabaseDto): Promise<ResponseBody<OperationResult>> {
		return this.databaseHubApiService.createDatabase(dto);
	}
}
