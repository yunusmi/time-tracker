import { ApiProperty } from '@nestjs/swagger';
import {
  IsISO8601,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

export class CreateManualEntryDto {
  @ApiProperty({
    required: false,
    format: 'uuid',
    description: 'Task this entry belongs to',
  })
  @IsOptional()
  @IsUUID()
  task_id?: string;

  @ApiProperty({ required: false, example: 'Code review' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiProperty({
    description: 'ISO timestamp when the work started (from)',
    example: '2026-05-21T09:00:00.000Z',
  })
  @IsISO8601()
  started_at: string;

  @ApiProperty({
    description: 'ISO timestamp when the work ended (to)',
    example: '2026-05-21T10:30:00.000Z',
  })
  @IsISO8601()
  ended_at: string;
}
