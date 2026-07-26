import { IsString, MinLength } from 'class-validator';

export class ConfirmPasswordResetDto {
  @IsString()
  token: string;

  @IsString()
  @MinLength(10, { message: 'La nuova password deve avere almeno 10 caratteri.' })
  newPassword: string;
}
