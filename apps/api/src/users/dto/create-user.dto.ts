import { IsEmail, IsIn, IsOptional, IsString, MinLength } from 'class-validator';

export class CreateUserDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(10)
  password: string;

  @IsString()
  firstName: string;

  @IsString()
  lastName: string;

  @IsString()
  roleKey: string;

  @IsOptional()
  @IsString()
  hourlyRate?: string;

  @IsOptional()
  @IsString()
  commissionPercent?: string;
}
