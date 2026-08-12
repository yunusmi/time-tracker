import { ApiProperty } from '@nestjs/swagger';
import { IsISO8601, IsOptional } from 'class-validator';

export class StopTimerDto {
  @ApiProperty({
    required: false,
    description:
      'Момент фактического окончания работы (для вычета простоя). ' +
      'Должен быть позже started_at; по умолчанию — текущее время.',
    example: '2026-08-12T15:30:00.000Z',
  })
  @IsOptional()
  @IsISO8601()
  ended_at?: string;
}
