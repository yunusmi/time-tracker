import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsEnum, IsInt, IsOptional, Max, Min } from 'class-validator';
import { ThemePreference } from '../entities/user-settings.entity';

export class UpdateUserSettingsDto {
  @ApiProperty({ required: false, minimum: 1, maximum: 12, example: 6 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(12)
  daily_goal_hours?: number;

  @ApiProperty({ required: false, minimum: 1, maximum: 30, example: 10 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(30)
  idle_threshold_minutes?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  notify_day_start?: boolean;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  notify_goal_reached?: boolean;

  @ApiProperty({ required: false, enum: ThemePreference })
  @IsOptional()
  @IsEnum(ThemePreference)
  theme?: ThemePreference;
}
