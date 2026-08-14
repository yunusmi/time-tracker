import { ApiProperty } from '@nestjs/swagger';
import { ArrayMaxSize, IsArray, IsIn, IsUUID } from 'class-validator';

export type BulkTaskAction = 'in_progress' | 'done' | 'todo' | 'delete';

export class BulkTasksDto {
  @ApiProperty({ type: [String], format: 'uuid' })
  @IsArray()
  @ArrayMaxSize(200)
  @IsUUID('4', { each: true })
  ids: string[];

  @ApiProperty({ enum: ['todo', 'in_progress', 'done', 'delete'] })
  @IsIn(['todo', 'in_progress', 'done', 'delete'])
  action: BulkTaskAction;
}
