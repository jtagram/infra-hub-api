import { Global, Module } from '@nestjs/common';
import { JwtPublicKeyService } from './jwt-public-key.service';

@Global()
@Module({
  providers: [JwtPublicKeyService],
  exports: [JwtPublicKeyService],
})
export class JwtPublicKeyModule {}
