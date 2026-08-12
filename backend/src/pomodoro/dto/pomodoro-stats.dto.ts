import { ApiProperty } from '@nestjs/swagger';

export class PomodoroStatsDto {
  @ApiProperty({ example: '2026-05-21' })
  date: string;

  @ApiProperty({ description: 'Completed work intervals', example: 6 })
  completed_work_sessions: number;

  @ApiProperty({ description: 'Total focused time in seconds', example: 9000 })
  total_focus_seconds: number;

  @ApiProperty({ description: 'Total break time in seconds', example: 1800 })
  total_break_seconds: number;
}
