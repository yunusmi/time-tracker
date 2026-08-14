import { ApiProperty } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsISO8601,
  IsObject,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';
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

  @ApiProperty({
    required: false,
    nullable: true,
    description: '«Не беспокоить» до (ISO); null — снять',
  })
  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsISO8601()
  dnd_until?: string | null;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  auto_stop_evening?: boolean;

  @ApiProperty({ required: false, example: 'Всем привет!' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  standup_greeting?: string;

  @ApiProperty({ required: false, example: 'код-ревью и созвоны' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  standup_misc_line?: string;

  @ApiProperty({ required: false, example: 'С уважением, Юнус' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  standup_signature?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  standup_auto_send?: boolean;

  @ApiProperty({ required: false, minimum: 1, maximum: 400, example: 80 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(400)
  monthly_hours_limit?: number;

  @ApiProperty({
    required: false,
    description: 'Матрица уведомлений {event: {email,push,app}}',
    example: { task_assigned: { email: true, push: false, app: true } },
  })
  @IsOptional()
  @IsObject()
  notification_prefs?: Record<
    string,
    Partial<Record<'email' | 'push' | 'app', boolean>>
  >;
}
