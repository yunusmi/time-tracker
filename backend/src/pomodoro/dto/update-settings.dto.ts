import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsInt, IsOptional, Max, Min } from 'class-validator';

export class UpdatePomodoroSettingsDto {
  @ApiProperty({ required: false, minimum: 1, maximum: 180, example: 25 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(180)
  work_minutes?: number;

  @ApiProperty({ required: false, minimum: 1, maximum: 60, example: 5 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(60)
  short_break_minutes?: number;

  @ApiProperty({ required: false, minimum: 1, maximum: 120, example: 15 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(120)
  long_break_minutes?: number;

  @ApiProperty({ required: false, minimum: 1, maximum: 12, example: 4 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(12)
  long_break_interval?: number;

  @ApiProperty({ required: false, example: false })
  @IsOptional()
  @IsBoolean()
  auto_start?: boolean;

  @ApiProperty({ required: false, example: true })
  @IsOptional()
  @IsBoolean()
  track_to_timer?: boolean;
}
