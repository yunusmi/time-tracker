import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Op } from 'sequelize';
import { PomodoroSettings } from './entities/pomodoro-settings.entity';
import {
  PomodoroPhase,
  PomodoroSession,
} from './entities/pomodoro-session.entity';
import { Task } from '../tasks/entities/task.entity';
import { UpdatePomodoroSettingsDto } from './dto/update-settings.dto';
import { CreatePomodoroSessionDto } from './dto/create-session.dto';
import { PomodoroStatsDto } from './dto/pomodoro-stats.dto';
import { TimeEntriesService } from '../time-entries/time-entries.service';
import { TasksService } from '../tasks/tasks.service';

@Injectable()
export class PomodoroService {
  constructor(
    @InjectModel(PomodoroSettings)
    private readonly settingsModel: typeof PomodoroSettings,
    @InjectModel(PomodoroSession)
    private readonly sessionModel: typeof PomodoroSession,
    private readonly tasksService: TasksService,
  ) {}

  async getSettings(userId: string): Promise<PomodoroSettings> {
    const [settings] = await this.settingsModel.findOrCreate({
      where: { user_id: userId },
      defaults: { user_id: userId },
    });
    return settings;
  }

  async updateSettings(
    userId: string,
    dto: UpdatePomodoroSettingsDto,
  ): Promise<PomodoroSettings> {
    const settings = await this.getSettings(userId);
    if (dto.work_minutes !== undefined) settings.work_minutes = dto.work_minutes;
    if (dto.short_break_minutes !== undefined)
      settings.short_break_minutes = dto.short_break_minutes;
    if (dto.long_break_minutes !== undefined)
      settings.long_break_minutes = dto.long_break_minutes;
    if (dto.long_break_interval !== undefined)
      settings.long_break_interval = dto.long_break_interval;
    if (dto.auto_start !== undefined) settings.auto_start = dto.auto_start;
    return settings.save();
  }

  async createSession(
    userId: string,
    dto: CreatePomodoroSessionDto,
  ): Promise<PomodoroSession> {
    if (dto.task_id) {
      await this.tasksService.findOne(userId, dto.task_id);
    }
    return this.sessionModel.create({
      user_id: userId,
      task_id: dto.task_id ?? null,
      phase: dto.phase,
      duration_seconds: dto.duration_seconds,
      completed: dto.completed ?? true,
      started_at: new Date(dto.started_at),
      ended_at: new Date(dto.ended_at),
    });
  }

  findSessions(
    userId: string,
    filters: { date?: string; task_id?: string },
  ): Promise<PomodoroSession[]> {
    const where: Record<string, unknown> = { user_id: userId };
    if (filters.task_id) {
      where.task_id = filters.task_id;
    }
    if (filters.date) {
      const { start, end } = TimeEntriesService.dayRange(filters.date);
      where.started_at = { [Op.between]: [start, end] };
    }
    return this.sessionModel.findAll({
      where,
      include: [Task],
      order: [['started_at', 'DESC']],
    });
  }

  async getStats(userId: string, date?: string): Promise<PomodoroStatsDto> {
    const { start, end } = TimeEntriesService.dayRange(date);
    const sessions = await this.sessionModel.findAll({
      where: { user_id: userId, started_at: { [Op.between]: [start, end] } },
    });

    let completed_work_sessions = 0;
    let total_focus_seconds = 0;
    let total_break_seconds = 0;

    for (const session of sessions) {
      if (session.phase === PomodoroPhase.WORK) {
        total_focus_seconds += session.duration_seconds;
        if (session.completed) {
          completed_work_sessions += 1;
        }
      } else {
        total_break_seconds += session.duration_seconds;
      }
    }

    return {
      date: start.toISOString().slice(0, 10),
      completed_work_sessions,
      total_focus_seconds,
      total_break_seconds,
    };
  }
}
