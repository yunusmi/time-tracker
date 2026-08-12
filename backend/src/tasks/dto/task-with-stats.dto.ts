import { ApiProperty } from '@nestjs/swagger';

export class TaskWithStatsDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty()
  title: string;

  @ApiProperty({ nullable: true })
  description: string | null;

  @ApiProperty()
  status: string;

  @ApiProperty({ nullable: true })
  estimated_minutes: number | null;

  @ApiProperty({ nullable: true })
  completed_at: Date | null;

  @ApiProperty()
  created_at: Date;

  @ApiProperty()
  updated_at: Date;

  @ApiProperty({ format: 'uuid' })
  user_id: string;

  @ApiProperty({
    description: 'Total tracked time across all time entries, in seconds',
    example: 5400,
  })
  total_tracked_seconds: number;

  @ApiProperty({
    description: 'Number of completed pomodoro work sessions for this task',
    example: 3,
  })
  pomodoro_count: number;
}
