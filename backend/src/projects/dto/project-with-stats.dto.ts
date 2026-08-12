import { ApiProperty } from '@nestjs/swagger';
import { Project } from '../entities/project.entity';

export class ProjectWithStatsDto extends Project {
  @ApiProperty({ description: 'Число задач в проекте', example: 3 })
  task_count: number;

  @ApiProperty({
    description: 'Затрекано за последние 7 дней, в секундах',
    example: 57600,
  })
  week_tracked_seconds: number;
}
