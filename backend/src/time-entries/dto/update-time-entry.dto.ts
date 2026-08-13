import { ApiProperty } from '@nestjs/swagger';
import {
  IsBoolean,
  IsISO8601,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';

export class UpdateTimeEntryDto {
  @ApiProperty({ required: false, format: 'uuid', nullable: true })
  @IsOptional()
  @IsUUID()
  task_id?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiProperty({ required: false, description: 'ISO start timestamp' })
  @IsOptional()
  @IsISO8601()
  started_at?: string;

  @ApiProperty({ required: false, description: 'ISO end timestamp' })
  @IsOptional()
  @IsISO8601()
  ended_at?: string;

  @ApiProperty({ required: false, description: 'Duration in seconds' })
  @IsOptional()
  @IsInt()
  @Min(0)
  duration_seconds?: number;

  @ApiProperty({ required: false, description: 'Оплачиваемая запись' })
  @IsOptional()
  @IsBoolean()
  billable?: boolean;

  @ApiProperty({ required: false, nullable: true, description: 'Комментарий' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;
}
