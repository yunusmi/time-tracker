import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiProperty,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsUUID } from 'class-validator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { ReportsService } from './reports.service';

class CreateShareDto {
  @ApiProperty({ required: false, nullable: true, format: 'uuid' })
  @IsOptional()
  @IsUUID()
  project_id?: string | null;
}

class UpdateShareDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  active?: boolean;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  hide_money?: boolean;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  hide_names?: boolean;
}

@ApiTags('reports')
@Controller()
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('invoices/preview')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Превью счёта из billable-часов (admin+)' })
  @ApiQuery({ name: 'from', required: true, example: '2026-08-06' })
  @ApiQuery({ name: 'to', required: true, example: '2026-08-12' })
  @ApiQuery({ name: 'project_id', required: false })
  invoicePreview(
    @CurrentUser('id') userId: string,
    @Query('from') from: string,
    @Query('to') to: string,
    @Query('project_id') projectId?: string,
  ) {
    return this.reportsService.invoicePreview(userId, from, to, projectId);
  }

  @Post('report-shares')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Получить/создать публичную ссылку на отчёт проекта (admin+)',
  })
  getOrCreateShare(
    @CurrentUser('id') userId: string,
    @Body() dto: CreateShareDto,
  ) {
    return this.reportsService.getOrCreateShare(userId, dto.project_id);
  }

  @Patch('report-shares/:id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Настройки публичной ссылки (admin+)' })
  updateShare(
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateShareDto,
  ) {
    return this.reportsService.updateShare(userId, id, dto);
  }

  @Get('reports/my-project')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Отчёт по своему проекту для ролей client/pm (без денег)',
  })
  myProjectReport(@CurrentUser('id') userId: string) {
    return this.reportsService.myProjectReport(userId);
  }

  @Get('public/reports/:token')
  @ApiOperation({
    summary: 'Публичный отчёт по токену (без авторизации, read-only)',
  })
  publicReport(@Param('token') token: string) {
    return this.reportsService.publicReport(token);
  }
}
