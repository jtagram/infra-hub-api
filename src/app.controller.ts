import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ResponseBody } from './common/dto/response-body.dto';
import { AppService } from './app.service';
import { Public } from './common/guards/public.decorator';
import { ApiGetHello } from './swagger/app.swagger';

@ApiTags('App')
@Controller()
export class AppController {
	constructor(private readonly appService: AppService) {}

	@Get()
	@Public()
	@ApiGetHello()
	getHello(): ResponseBody<string> {
		return this.appService.getHello();
	}
}
