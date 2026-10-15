import { Global, Module } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { DatabaseExceptionFilter } from './database-exception.filter';
import { HttpExceptionFilter } from './http-exception.filter';
import { UnknownExceptionFilter } from './unknown-exception.filter';

@Global()
@Module({
	providers: [
		// NestJS evaluates global APP_FILTER providers in reverse registration
		// order (RouterExceptionFilters.create() calls filters.reverse()), and
		// picks the first one whose @Catch() type matches. Registering the
		// catch-all filter first here means it runs LAST, after the specific
		// ones get a chance to match.
		{ provide: APP_FILTER, useClass: UnknownExceptionFilter },
		{ provide: APP_FILTER, useClass: HttpExceptionFilter },
		{ provide: APP_FILTER, useClass: DatabaseExceptionFilter },
	],
})
export class FilterModule {}
