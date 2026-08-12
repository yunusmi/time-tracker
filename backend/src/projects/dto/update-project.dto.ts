import { ApiProperty } from '@nestjs/swagger';
import {
  IsBoolean,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class UpdateProjectDto {
  @ApiProperty({ required: false, example: 'Разработка' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  name?: string;

  @ApiProperty({ required: false, example: '#60a5fa' })
  @IsOptional()
  @IsString()
  @Matches(/^#[0-9a-fA-F]{6}$/, { message: 'color must be a hex color like #60a5fa' })
  color?: string;

  @ApiProperty({
    required: false,
    description: 'true — скрыть проект из списков (архив)',
  })
  @IsOptional()
  @IsBoolean()
  archived?: boolean;
}
