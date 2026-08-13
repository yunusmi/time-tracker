import { ApiProperty } from '@nestjs/swagger';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { TaskPriority, TaskStatus } from '../entities/task.entity';

export class CreateTaskDto {
  @ApiProperty({ example: 'Write project documentation' })
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  title: string;

  @ApiProperty({ required: false, example: 'Cover the API and setup steps' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({
    required: false,
    enum: TaskStatus,
    default: TaskStatus.TODO,
  })
  @IsOptional()
  @IsEnum(TaskStatus)
  status?: TaskStatus;

  @ApiProperty({
    required: false,
    description: 'Planned execution time in minutes',
    example: 120,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  estimated_minutes?: number;

  @ApiProperty({
    required: false,
    nullable: true,
    format: 'uuid',
    description: 'Проект задачи',
  })
  @IsOptional()
  @IsUUID()
  project_id?: string | null;

  @ApiProperty({
    required: false,
    nullable: true,
    format: 'uuid',
    description: 'Исполнитель (назначать может admin+); по умолчанию — создатель',
  })
  @IsOptional()
  @IsUUID()
  assignee_id?: string | null;

  @ApiProperty({ required: false, enum: TaskPriority, default: TaskPriority.MED })
  @IsOptional()
  @IsEnum(TaskPriority)
  priority?: TaskPriority;

  @ApiProperty({ required: false, nullable: true, example: '2026-08-20' })
  @IsOptional()
  @IsDateString()
  due_date?: string | null;

  @ApiProperty({
    required: false,
    nullable: true,
    example: 'https://notion.so/task-123',
    description: 'Ссылка на задачу во внешней системе (Notion/Jira)',
  })
  @IsOptional()
  @IsString()
  @MaxLength(1024)
  external_url?: string | null;
}
