import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString, Length } from 'class-validator';

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
}
