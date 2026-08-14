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
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { ReportsService } from './reports.service';
import {
  GeneratorMode,
  StandupDirection,
  StandupService,
} from './standup.service';

class GenerateReportDto {
  @ApiProperty({ enum: ['standup', 'client', 'team', 'notes'] })
  @IsIn(['standup', 'client', 'team', 'notes'])
  mode: GeneratorMode;

  @ApiProperty({ required: false, enum: ['ys', 'st'], description: 'Стендап: вчера→сегодня / сегодня→завтра' })
  @IsOptional()
  @IsIn(['ys', 'st'])
  direction?: StandupDirection;

  @ApiProperty({ required: false, description: '+ активности (код-ревью и созвоны)' })
  @IsOptional()
  @IsBoolean()
  include_misc?: boolean;

  @ApiProperty({ required: false, description: 'AI-сводка по задачам' })
  @IsOptional()
  @IsBoolean()
  ai_summary?: boolean;

  @ApiProperty({ required: false, minimum: 1, maximum: 400, example: 80 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(400)
  hours_limit?: number;

  @ApiProperty({ required: false, nullable: true, format: 'uuid' })
  @IsOptional()
  @IsUUID()
  project_id?: string | null;
}

class StandupDto {
  @ApiProperty({ required: false, enum: ['ys', 'st'] })
  @IsOptional()
  @IsIn(['ys', 'st'])
  direction?: StandupDirection;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  include_misc?: boolean;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  ai_summary?: boolean;

  @ApiProperty({ required: false, minimum: 1, maximum: 400 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(400)
  hours_limit?: number;
}

class SendReportDto {
  @ApiProperty({ enum: ['slack', 'tg'] })
  @IsIn(['slack', 'tg'])
  channel: 'slack' | 'tg';

  @ApiProperty({ description: 'Текст для отправки' })
  @IsString()
  @MinLength(1)
  @MaxLength(20000)
  text: string;
}

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

class CreateCommentDto {
  @ApiProperty({ example: 'Почему в среду меньше часов?' })
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  body: string;

  @ApiProperty({ required: false, nullable: true, format: 'uuid' })
  @IsOptional()
  @IsUUID()
  project_id?: string | null;
}

@ApiTags('reports')
@Controller()
export class ReportsController {
  constructor(
    private readonly reportsService: ReportsService,
    private readonly standupService: StandupService,
  ) {}

  @Post('reports/generate')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary:
      'Генератор текстов: стендап / отчёт для клиента / сводка команды / release notes',
  })
  generate(@CurrentUser('id') userId: string, @Body() dto: GenerateReportDto) {
    return this.standupService.generate(userId, dto);
  }

  @Post('reports/standup')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Стендап-отчёт (генерация на сервере)' })
  standup(@CurrentUser('id') userId: string, @Body() dto: StandupDto) {
    return this.standupService.generate(userId, { ...dto, mode: 'standup' });
  }

  @Post('reports/send')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary:
      'Отправить текст в Slack/Telegram через вебхук (sent=false — демо-режим)',
  })
  sendReport(@Body() dto: SendReportDto) {
    return this.standupService.send(dto.channel, dto.text);
  }

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

  @Get('reports/client-dashboard')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Клиентский дашборд: бюджет этапа, вехи проекта, лента недели',
  })
  clientDashboard(@CurrentUser('id') userId: string) {
    return this.reportsService.clientDashboard(userId);
  }

  @Get('report-comments')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Вопросы по отчёту: тред клиент ↔ менеджер' })
  @ApiQuery({ name: 'project_id', required: false })
  listComments(
    @CurrentUser('id') userId: string,
    @Query('project_id') projectId?: string,
  ) {
    return this.reportsService.listComments(userId, projectId);
  }

  @Post('report-comments')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Написать в тред по отчёту' })
  addComment(
    @CurrentUser('id') userId: string,
    @Body() dto: CreateCommentDto,
  ) {
    return this.reportsService.addComment(userId, dto.body, dto.project_id);
  }

  @Get('public/reports/:token')
  @ApiOperation({
    summary: 'Публичный отчёт по токену (без авторизации, read-only)',
  })
  publicReport(@Param('token') token: string) {
    return this.reportsService.publicReport(token);
  }
}
