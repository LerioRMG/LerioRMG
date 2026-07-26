import { PartialType } from '@nestjs/mapped-types';
import { IsIn, IsOptional } from 'class-validator';
import { CreateCreatorDto } from './create-creator.dto';

export class UpdateCreatorDto extends PartialType(CreateCreatorDto) {
  @IsOptional()
  @IsIn(['ACTIVE', 'INACTIVE', 'SUSPENDED', 'ONBOARDING'])
  status?: string;
}
