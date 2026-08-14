import { ApiProperty } from '@nestjs/swagger';
import {
  IsEnum,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { MilestoneStatus } from '../entities/milestone.entity';

export class CreateMilestoneDto {
  @ApiProperty({ example: 'Бета-версия' })
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  title: string;

  @ApiProperty({ required: false, nullable: true, example: '2026-09-01' })
  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  due_date?: string | null;
}

export class UpdateMilestoneDto {
  @ApiProperty({ required: false, example: 'Бета-версия' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  title?: string;

  @ApiProperty({ required: false, nullable: true, example: '2026-09-01' })
  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  due_date?: string | null;

  @ApiProperty({ required: false, enum: MilestoneStatus })
  @IsOptional()
  @IsEnum(MilestoneStatus)
  status?: MilestoneStatus;
}
