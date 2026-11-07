import { Injectable } from '@nestjs/common';
import { ResponseBody } from './common/dto/response-body.dto';

const GREETING_MESSAGE = 'Service is running';
const GREETING = 'Hello World!';

@Injectable()
export class AppService {
	getHello(): ResponseBody<string> {
		return ResponseBody.success(GREETING_MESSAGE, GREETING);
	}
}
