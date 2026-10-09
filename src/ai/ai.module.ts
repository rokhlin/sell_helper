import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AiService } from './ai.service';
import { PromptRegistryService } from './prompt-registry.service';

@Module({
  imports: [ConfigModule],
  providers: [AiService, PromptRegistryService],
  exports: [AiService, PromptRegistryService],
})
export class AiModule {}
