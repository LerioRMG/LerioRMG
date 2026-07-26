import { Module } from '@nestjs/common';
import { AutomationsController } from './automations.controller';
import { AutomationsService } from './automations.service';
import { AutomationsRunnerService } from './automations-runner.service';

@Module({
  controllers: [AutomationsController],
  providers: [AutomationsService, AutomationsRunnerService],
})
export class AutomationsModule {}
