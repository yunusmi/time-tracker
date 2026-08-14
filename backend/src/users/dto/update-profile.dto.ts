import { ApiProperty } from '@nestjs/swagger';
import {
  IsEmail,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateIf,
} from 'class-validator';

export class UpdateProfileDto {
  @ApiProperty({ required: false, example: 'Юнус М.' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  name?: string;

  @ApiProperty({
    required: false,
    example: 'yunus@example.com',
    description: 'Смена email сбрасывает верификацию почты',
  })
  @IsOptional()
  @IsEmail()
  email?: string;
}

export class UpdateAvatarDto {
  @ApiProperty({
    required: false,
    nullable: true,
    description: 'data-URL квадратного изображения 128px или null (снять фото)',
  })
  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsString()
  @MaxLength(700_000)
  avatar_url?: string | null;
}

export class DeleteAccountDto {
  @ApiProperty({
    description: 'Подтверждение: точный email аккаунта',
    example: 'yunus@example.com',
  })
  @IsEmail()
  email: string;
}

export class ChangePasswordDto {
  @ApiProperty({ example: 'old-password' })
  @IsString()
  @MinLength(1)
  current_password: string;

  @ApiProperty({ example: 'new-password-123', minLength: 8 })
  @IsString()
  @MinLength(8)
  @MaxLength(72)
  new_password: string;
}
