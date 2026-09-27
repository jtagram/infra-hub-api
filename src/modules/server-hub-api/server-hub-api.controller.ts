import { Body, Controller, Post } from '@nestjs/common';
import { OperationResult } from '../../common/dto/operation-result.dto';
import { Roles } from '../../common/guards/roles.decorator';
import { Role } from '../../common/roles/role.enum';
import { ServerHubApiService } from './server-hub-api.service';
import { ManageServerDto } from './server-hub-api.dto';

@Controller('server-hub-api')
export class ServerHubApiController {
  constructor(private readonly serverHubApiService: ServerHubApiService) {}

  @Post('manage-server')
  @Roles(Role.ADMIN)
  async manageServer(
    @Body() dto: ManageServerDto,
  ): Promise<OperationResult> {
    return this.serverHubApiService.manageServer(dto);
  }
}
