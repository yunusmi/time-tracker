import { ApiProperty } from '@nestjs/swagger';

export class SummaryProjectBreakdownDto {
  @ApiProperty({
    format: 'uuid',
    nullable: true,
    description: 'null — записи без проекта',
  })
  project_id: string | null;

  @ApiProperty({ example: 7200 })
  seconds: number;

  @ApiProperty({ example: 5400, description: 'Из них оплачиваемых' })
  billable_seconds: number;
}

export class SummaryTaskBreakdownDto {
  @ApiProperty({ format: 'uuid' })
  task_id: string;

  @ApiProperty({ example: 'API интеграции платежей' })
  task_title: string;

  @ApiProperty({
    format: 'uuid',
    nullable: true,
  })
  project_id: string | null;

  @ApiProperty({ example: 3600 })
  seconds: number;

  @ApiProperty({ example: 3600, description: 'Из них оплачиваемых' })
  billable_seconds: number;
}

export class DaySummaryDto {
  @ApiProperty({ example: '2026-08-12', description: 'UTC-день' })
  date: string;

  @ApiProperty({ example: 14700 })
  total_seconds: number;

  @ApiProperty({ type: [SummaryProjectBreakdownDto] })
  by_project: SummaryProjectBreakdownDto[];

  @ApiProperty({ type: [SummaryTaskBreakdownDto] })
  by_task: SummaryTaskBreakdownDto[];
}
