import { IsIn, IsOptional, IsString } from 'class-validator';

export class ConnectAccountDto {
  @IsString()
  username: string;

  @IsString()
  displayName: string;

  @IsIn(['MANUAL', 'CSV_IMPORT', 'PROVIDER_API_1', 'PROVIDER_API_2'])
  provider: string;

  @IsOptional()
  @IsString()
  profileUrl?: string;

  @IsOptional()
  @IsString()
  apiKey?: string;

  @IsOptional()
  @IsString()
  apiSecret?: string;

  @IsOptional()
  @IsString()
  currency?: string;

  @IsOptional()
  @IsString()
  timezone?: string;
}
