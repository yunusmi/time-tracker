import { ApiProperty } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEnum,
  IsISO8601,
  IsInt,
  IsOptional,
  IsUUID,
  Min,
} from 'class-validator';
import { PomodoroPhase } from '../entities/pomodoro-session.entity';

export class CreatePomodoroSessionDto {
  @ApiProperty({ enum: PomodoroPhase, example: PomodoroPhase.WORK })
  @IsEnum(PomodoroPhase)
  phase: PomodoroPhase;

  @ApiProperty({ description: 'Session length in seconds', example: 1500 })
  @IsInt()
  @Min(1)
  duration_seconds: number;

  @ApiProperty({ required: false, default: true })
  @IsOptional()
  @IsBoolean()
  completed?: boolean;

  @ApiProperty({ example: '2026-05-21T09:00:00.000Z' })
  @IsISO8601()
  started_at: string;

  @ApiProperty({ example: '2026-05-21T09:25:00.000Z' })
  @IsISO8601()
  ended_at: string;

  @ApiProperty({ required: false, format: 'uuid' })
  @IsOptional()
  @IsUUID()
  task_id?: string;
}
