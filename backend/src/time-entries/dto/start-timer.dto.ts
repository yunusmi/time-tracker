import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class StartTimerDto {
  @ApiProperty({
    required: false,
    format: 'uuid',
    description: 'Task this timer belongs to',
  })
  @IsOptional()
  @IsUUID()
  task_id?: string;

  @ApiProperty({ required: false, example: 'Working on the API layer' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;
}
