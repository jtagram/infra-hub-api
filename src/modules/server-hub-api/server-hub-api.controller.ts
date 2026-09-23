import { Body, Controller, Post } from '@nestjs/common';
import { ServerHubApiService } from './server-hub-api.service';
import { ManageServerDto, ServerOperationResult } from './server-hub-api.dto';

@Controller('server-hub-api')
export class ServerHubApiController {
  constructor(private readonly serverHubApiService: ServerHubApiService) {}

  @Post('manage-server')
  async manageServer(
    @Body() dto: ManageServerDto,
  ): Promise<ServerOperationResult> {
    return this.serverHubApiService.manageServer(dto);
  }
}
