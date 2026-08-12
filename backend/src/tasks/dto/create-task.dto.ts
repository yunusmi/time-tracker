import { ApiProperty } from '@nestjs/swagger';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { TaskStatus } from '../entities/task.entity';

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
}
