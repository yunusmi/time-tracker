import { Controller, Get, Query, Res, UseGuards } from '@nestjs/common';
import { Response } from 'express';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiProduces,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { ExportService } from './export.service';

@ApiTags('export')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('export')
export class ExportController {
  constructor(private readonly exportService: ExportService) {}

  @Get('today')
  @ApiOperation({
    summary: "Download today's completed tasks and time log as an .xlsx file",
  })
  @ApiQuery({
    name: 'date',
    required: false,
    description: 'UTC day to export (YYYY-MM-DD). Defaults to today.',
    example: '2026-05-21',
  })
  @ApiProduces(
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  )
  @ApiResponse({ status: 200, description: 'XLSX binary stream' })
  async exportToday(
    @CurrentUser('id') userId: string,
    @Res() res: Response,
    @Query('date') date?: string,
  ): Promise<void> {
    const { buffer, filename } = await this.exportService.buildDailyReport(
      userId,
      date,
    );
    res.set({
      'Content-Type':
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': buffer.length.toString(),
    });
    res.end(buffer);
  }

  @Get('report')
  @ApiOperation({
    summary: 'Экспорт за период (день/неделя/месяц) с фильтром по проекту',
  })
  @ApiQuery({ name: 'from', required: true, example: '2026-08-06' })
  @ApiQuery({ name: 'to', required: true, example: '2026-08-12' })
  @ApiQuery({ name: 'project_id', required: false })
  @ApiProduces(
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  )
  @ApiResponse({ status: 200, description: 'XLSX binary stream' })
  async exportRange(
    @CurrentUser('id') userId: string,
    @Res() res: Response,
    @Query('from') from: string,
    @Query('to') to: string,
    @Query('project_id') projectId?: string,
  ): Promise<void> {
    const { buffer, filename } = await this.exportService.buildRangeReport(
      userId,
      from,
      to,
      projectId,
    );
    res.set({
      'Content-Type':
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': buffer.length.toString(),
    });
    res.end(buffer);
  }
}
