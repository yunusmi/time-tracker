import {
  Body,
  Controller,
  Get,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { PomodoroService } from './pomodoro.service';
import { UpdatePomodoroSettingsDto } from './dto/update-settings.dto';
import { CreatePomodoroSessionDto } from './dto/create-session.dto';
import { PomodoroSettings } from './entities/pomodoro-settings.entity';
import { PomodoroSession } from './entities/pomodoro-session.entity';
import { PomodoroStatsDto } from './dto/pomodoro-stats.dto';

@ApiTags('pomodoro')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('pomodoro')
export class PomodoroController {
  constructor(private readonly pomodoroService: PomodoroService) {}

  @Get('settings')
  @ApiOperation({ summary: 'Get pomodoro settings (created with defaults if missing)' })
  @ApiResponse({ status: 200, type: PomodoroSettings })
  getSettings(@CurrentUser('id') userId: string): Promise<PomodoroSettings> {
    return this.pomodoroService.getSettings(userId);
  }

  @Patch('settings')
  @ApiOperation({ summary: 'Update pomodoro settings' })
  @ApiResponse({ status: 200, type: PomodoroSettings })
  updateSettings(
    @CurrentUser('id') userId: string,
    @Body() dto: UpdatePomodoroSettingsDto,
  ): Promise<PomodoroSettings> {
    return this.pomodoroService.updateSettings(userId, dto);
  }

  @Post('sessions')
  @ApiOperation({ summary: 'Record a finished pomodoro interval' })
  @ApiResponse({ status: 201, type: PomodoroSession })
  createSession(
    @CurrentUser('id') userId: string,
    @Body() dto: CreatePomodoroSessionDto,
  ): Promise<PomodoroSession> {
    return this.pomodoroService.createSession(userId, dto);
  }

  @Get('sessions')
  @ApiOperation({ summary: 'List pomodoro sessions' })
  @ApiQuery({ name: 'date', required: false, example: '2026-05-21' })
  @ApiQuery({ name: 'task_id', required: false })
  @ApiResponse({ status: 200, type: [PomodoroSession] })
  findSessions(
    @CurrentUser('id') userId: string,
    @Query('date') date?: string,
    @Query('task_id') task_id?: string,
  ): Promise<PomodoroSession[]> {
    return this.pomodoroService.findSessions(userId, { date, task_id });
  }

  @Get('stats')
  @ApiOperation({ summary: 'Pomodoro stats for a day (default: today)' })
  @ApiQuery({ name: 'date', required: false, example: '2026-05-21' })
  @ApiResponse({ status: 200, type: PomodoroStatsDto })
  getStats(
    @CurrentUser('id') userId: string,
    @Query('date') date?: string,
  ): Promise<PomodoroStatsDto> {
    return this.pomodoroService.getStats(userId, date);
  }
}
