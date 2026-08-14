import { ApiProperty } from '@nestjs/swagger';

export class AuthUserDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ example: 'user@example.com' })
  email: string;

  @ApiProperty({ example: 'John Doe' })
  name: string;

  @ApiProperty({ required: false, nullable: true })
  avatar_url?: string | null;

  @ApiProperty({ required: false, nullable: true })
  email_verified_at?: Date | null;

  @ApiProperty({ required: false })
  totp_enabled?: boolean;
}

export class AuthResponseDto {
  @ApiProperty({ description: 'JWT access token' })
  access_token: string;

  @ApiProperty({ type: AuthUserDto })
  user: AuthUserDto;
}
