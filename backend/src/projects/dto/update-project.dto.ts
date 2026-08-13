import { ApiProperty } from '@nestjs/swagger';
import {
  IsBoolean,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
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

  @ApiProperty({ required: false, description: 'Часовая ставка, ₽/ч', example: 2500 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  hourly_rate?: number;

  @ApiProperty({
    required: false,
    description: 'Недельный бюджет часов (0 — не задан)',
    example: 20,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  weekly_budget_hours?: number;
}
