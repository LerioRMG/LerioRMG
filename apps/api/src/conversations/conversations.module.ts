import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConversationsController } from './conversations.controller';
import { ConversationsService } from './conversations.service';
import { ConversationsGateway } from './conversations.gateway';
import { OnlyFansAccountsModule } from '../onlyfans-accounts/onlyfans-accounts.module';

@Module({
  imports: [JwtModule.register({}), OnlyFansAccountsModule],
  controllers: [ConversationsController],
  providers: [ConversationsService, ConversationsGateway],
  exports: [ConversationsGateway],
})
export class ConversationsModule {}
