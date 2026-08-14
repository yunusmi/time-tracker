import { ApiProperty } from '@nestjs/swagger';
import {
  IsEmail,
  IsOptional,
  IsString,
  Length,
  MinLength,
} from 'class-validator';

export class LoginDto {
  @ApiProperty({ example: 'user@example.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'strongPassword123' })
  @IsString()
  password: string;

  @ApiProperty({
    required: false,
    example: '123456',
    description: 'Код 2FA (обязателен, если включена TOTP)',
  })
  @IsOptional()
  @IsString()
  @Length(6, 6)
  totp_code?: string;

  @ApiProperty({
    required: false,
    description: 'Ответ на капчу (требуется после 2 неудачных попыток)',
  })
  @IsOptional()
  @IsString()
  captcha_answer?: string;
}

export class MagicLinkDto {
  @ApiProperty({ example: 'user@example.com' })
  @IsEmail()
  email: string;
}

export class ForgotPasswordDto {
  @ApiProperty({ example: 'user@example.com' })
  @IsEmail()
  email: string;
}

export class ResetPasswordDto {
  @ApiProperty({ description: 'Токен из письма' })
  @IsString()
  token: string;

  @ApiProperty({ example: 'newStrongPassword', minLength: 8 })
  @IsString()
  @MinLength(8)
  new_password: string;
}
