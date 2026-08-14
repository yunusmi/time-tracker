import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Op } from 'sequelize';
import { TimeEntry } from './entities/time-entry.entity';
import { Task } from '../tasks/entities/task.entity';
import { Project } from '../projects/entities/project.entity';
import { StartTimerDto } from './dto/start-timer.dto';
import { CreateManualEntryDto } from './dto/create-manual-entry.dto';
import { UpdateTimeEntryDto } from './dto/update-time-entry.dto';
import { TasksService } from '../tasks/tasks.service';
import { WorkspacesService } from '../workspaces/workspaces.service';
import { TimesheetsService } from '../timesheets/timesheets.service';

@Injectable()
export class TimeEntriesService {
  constructor(
    @InjectModel(TimeEntry)
    private readonly timeEntryModel: typeof TimeEntry,
    private readonly tasksService: TasksService,
    private readonly workspacesService: WorkspacesService,
    private readonly timesheetsService: TimesheetsService,
  ) {}

  /** Утверждённая неделя блокирует изменение её записей. */
  private async assertWeekUnlocked(userId: string, date: Date): Promise<void> {
    if (await this.timesheetsService.isWeekLocked(userId, date)) {
      throw new ForbiddenException('Неделя утверждена — записи заблокированы');
    }
  }

  private async assertTaskOwnership(
    userId: string,
    taskId?: string | null,
  ): Promise<void> {
    if (taskId) {
      // Throws NotFoundException if the task does not belong to the user.
      await this.tasksService.findOne(userId, taskId);
    }
  }

  /**
   * Условие изоляции записей по компании: записи текущей компании плюс
   * «старые» без workspace_id (созданные до мультитенантности).
   */
  private async entriesScope(userId: string): Promise<Record<string, unknown>> {
    const ctx = await this.workspacesService.getContext(userId);
    return {
      [Op.or]: [
        { workspace_id: ctx.workspace.id },
        { workspace_id: { [Op.is]: null } },
      ],
    };
  }
  async getActive(userId: string): Promise<TimeEntry | null> {
    return this.timeEntryModel.findOne({
      where: {
        user_id: userId,
        ended_at: { [Op.is]: null },
        ...(await this.entriesScope(userId)),
      },
      include: [{ model: Task, include: [Project] }],
    });
  }

  async start(userId: string, dto: StartTimerDto): Promise<TimeEntry> {
    await this.assertTaskOwnership(userId, dto.task_id);

    // Clockify-style: starting a new timer stops the running one.
    const running = await this.getActive(userId);
    if (running) {
      await this.finishEntry(running);
    }

    const ctx = await this.workspacesService.getContext(userId);
    return this.timeEntryModel.create({
      user_id: userId,
      workspace_id: ctx.workspace.id,
      task_id: dto.task_id ?? null,
      description: dto.description ?? null,
      started_at: new Date(),
      ended_at: null,
      duration_seconds: 0,
      is_manual: false,
    });
  }

  /**
   * Останавливает текущий таймер. Опциональный endedAt позволяет «вычесть
   * простой»: запись закрывается моментом последней активности.
   */
  async stop(userId: string, endedAt?: string): Promise<TimeEntry> {
    const running = await this.getActive(userId);
    if (!running) {
      throw new BadRequestException('No timer is currently running');
    }
    let end: Date | undefined;
    if (endedAt) {
      end = new Date(endedAt);
      if (Number.isNaN(end.getTime())) {
        throw new BadRequestException('Invalid ended_at');
      }
      if (end.getTime() <= running.started_at.getTime()) {
        throw new BadRequestException('ended_at must be after started_at');
      }
      if (end.getTime() > Date.now()) {
        throw new BadRequestException('ended_at must not be in the future');
      }
    }
    return this.finishEntry(running, end);
  }

  private finishEntry(entry: TimeEntry, endedAt?: Date): Promise<TimeEntry> {
    const end = endedAt ?? new Date();
    entry.ended_at = end;
    entry.duration_seconds = Math.max(
      0,
      Math.round((end.getTime() - entry.started_at.getTime()) / 1000),
    );
    return entry.save();
  }

  /**
   * Сводка по дням за период [from..to] (UTC-дни): на каждый день —
   * total_seconds и разбивка по проектам и задачам. Один запрос для
   * недельного графика, streak и heatmap.
   */
  async summary(
    userId: string,
    from: string,
    to: string,
    targetUserId?: string,
  ): Promise<
    Array<{
      date: string;
      total_seconds: number;
      by_project: Array<{
        project_id: string | null;
        seconds: number;
        billable_seconds: number;
      }>;
      by_task: Array<{
        task_id: string;
        task_title: string;
        project_id: string | null;
        seconds: number;
        billable_seconds: number;
      }>;
    }>
  > {
    const { start } = TimeEntriesService.dayRange(from);
    const { end } = TimeEntriesService.dayRange(to);
    if (start.getTime() > end.getTime()) {
      throw new BadRequestException('from must not be after to');
    }

    // Чужие данные — только admin+ и только по участникам своей команды.
    let scopeUserId = userId;
    if (targetUserId && targetUserId !== userId) {
      const ctx = await this.workspacesService.getContext(userId);
      if (!ctx.isAdmin) {
        throw new ForbiddenException(
          'Отчёты других участников доступны только админу',
        );
      }
      if (!ctx.memberIds.includes(targetUserId)) {
        throw new NotFoundException('Участник не найден в команде');
      }
      scopeUserId = targetUserId;
    }

    const entries = await this.timeEntryModel.findAll({
      where: {
        user_id: scopeUserId,
        started_at: { [Op.between]: [start, end] },
        ...(await this.entriesScope(userId)),
      },
      include: [{ model: Task, include: [Project] }],
      order: [['started_at', 'ASC']],
    });

    type DayAgg = {
      total: number;
      byProject: Map<string | null, { seconds: number; billable: number }>;
      byTask: Map<
        string,
        {
          title: string;
          project_id: string | null;
          seconds: number;
          billable: number;
        }
      >;
    };
    const days = new Map<string, DayAgg>();

    for (const e of entries) {
      const date = e.started_at.toISOString().slice(0, 10);
      let agg = days.get(date);
      if (!agg) {
        agg = { total: 0, byProject: new Map(), byTask: new Map() };
        days.set(date, agg);
      }
      const seconds = e.duration_seconds;
      const billableSec = e.billable === false ? 0 : seconds;
      agg.total += seconds;

      const projectId = e.task?.project_id ?? null;
      const p = agg.byProject.get(projectId) ?? { seconds: 0, billable: 0 };
      p.seconds += seconds;
      p.billable += billableSec;
      agg.byProject.set(projectId, p);

      if (e.task) {
        const t = agg.byTask.get(e.task.id);
        if (t) {
          t.seconds += seconds;
          t.billable += billableSec;
        } else {
          agg.byTask.set(e.task.id, {
            title: e.task.title,
            project_id: projectId,
            seconds,
            billable: billableSec,
          });
        }
      }
    }

    return [...days.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, agg]) => ({
        date,
        total_seconds: agg.total,
        by_project: [...agg.byProject.entries()].map(([project_id, p]) => ({
          project_id,
          seconds: p.seconds,
          billable_seconds: p.billable,
        })),
        by_task: [...agg.byTask.entries()].map(([task_id, t]) => ({
          task_id,
          task_title: t.title,
          project_id: t.project_id,
          seconds: t.seconds,
          billable_seconds: t.billable,
        })),
      }));
  }

  async createManual(
    userId: string,
    dto: CreateManualEntryDto,
  ): Promise<TimeEntry> {
    await this.assertTaskOwnership(userId, dto.task_id);
    await this.assertWeekUnlocked(userId, new Date(dto.started_at));

    const startedAt = new Date(dto.started_at);
    const endedAt = new Date(dto.ended_at);
    if (endedAt.getTime() <= startedAt.getTime()) {
      throw new BadRequestException('ended_at must be after started_at');
    }
    const durationSeconds = Math.round(
      (endedAt.getTime() - startedAt.getTime()) / 1000,
    );

    const ctx = await this.workspacesService.getContext(userId);
    return this.timeEntryModel.create({
      user_id: userId,
      workspace_id: ctx.workspace.id,
      task_id: dto.task_id ?? null,
      description: dto.description ?? null,
      started_at: startedAt,
      ended_at: endedAt,
      duration_seconds: durationSeconds,
      is_manual: true,
    });
  }

  async findAll(
    userId: string,
    filters: { date?: string; task_id?: string; user_id?: string },
  ): Promise<TimeEntry[]> {
    // Чужие записи — только admin+ и только по своей команде.
    let scopeUserId = userId;
    if (filters.user_id && filters.user_id !== userId) {
      const ctx = await this.workspacesService.getContext(userId);
      if (!ctx.isAdmin) {
        throw new ForbiddenException(
          'Записи других участников доступны только админу',
        );
      }
      if (!ctx.memberIds.includes(filters.user_id)) {
        throw new NotFoundException('Участник не найден в команде');
      }
      scopeUserId = filters.user_id;
    }
    const where: Record<string, unknown> = {
      user_id: scopeUserId,
      ...(await this.entriesScope(userId)),
    };
    if (filters.task_id) {
      where.task_id = filters.task_id;
    }
    if (filters.date) {
      const { start, end } = TimeEntriesService.dayRange(filters.date);
      where.started_at = { [Op.between]: [start, end] };
    }
    return this.timeEntryModel.findAll({
      where,
      include: [{ model: Task, include: [Project] }],
      order: [['started_at', 'DESC']],
    });
  }

  /** Записи, начавшиеся в диапазоне UTC-дней [from..to] (для экспорта). */
  async findForRange(
    userId: string,
    from: string,
    to: string,
  ): Promise<TimeEntry[]> {
    const start = TimeEntriesService.dayRange(from).start;
    const end = TimeEntriesService.dayRange(to).end;
    return this.timeEntryModel.findAll({
      where: {
        user_id: userId,
        started_at: { [Op.between]: [start, end] },
        ...(await this.entriesScope(userId)),
      },
      include: [{ model: Task, include: [Project] }],
      order: [['started_at', 'ASC']],
    });
  }

  /** Entries that started within the given day (default: today). */
  async findForDay(userId: string, date?: string): Promise<TimeEntry[]> {
    const { start, end } = TimeEntriesService.dayRange(date);
    return this.timeEntryModel.findAll({
      where: {
        user_id: userId,
        started_at: { [Op.between]: [start, end] },
        ...(await this.entriesScope(userId)),
      },
      include: [{ model: Task, include: [Project] }],
      order: [['started_at', 'ASC']],
    });
  }

  async findOne(userId: string, id: string): Promise<TimeEntry> {
    const entry = await this.timeEntryModel.findOne({
      where: { id, user_id: userId },
      include: [{ model: Task, include: [Project] }],
    });
    if (!entry) {
      throw new NotFoundException('Time entry not found');
    }
    return entry;
  }

  async update(
    userId: string,
    id: string,
    dto: UpdateTimeEntryDto,
  ): Promise<TimeEntry> {
    const entry = await this.findOne(userId, id);
    await this.assertWeekUnlocked(userId, entry.started_at);
    if (dto.task_id !== undefined) {
      await this.assertTaskOwnership(userId, dto.task_id);
      entry.task_id = dto.task_id ?? null;
    }
    if (dto.description !== undefined) {
      entry.description = dto.description;
    }
    if (dto.started_at) {
      entry.started_at = new Date(dto.started_at);
    }
    if (dto.ended_at) {
      entry.ended_at = new Date(dto.ended_at);
    }
    if (dto.billable !== undefined) {
      entry.billable = dto.billable;
    }
    if (dto.note !== undefined) {
      entry.note = dto.note || null;
    }
    if (dto.duration_seconds !== undefined) {
      entry.duration_seconds = dto.duration_seconds;
    } else if (entry.ended_at) {
      entry.duration_seconds = Math.max(
        0,
        Math.round(
          (entry.ended_at.getTime() - entry.started_at.getTime()) / 1000,
        ),
      );
    }
    return entry.save();
  }

  async remove(userId: string, id: string): Promise<void> {
    const entry = await this.findOne(userId, id);
    await this.assertWeekUnlocked(userId, entry.started_at);
    await entry.destroy();
  }

  /** Returns the [start, end] timestamps covering a UTC calendar day. */
  static dayRange(date?: string): { start: Date; end: Date } {
    const base = date ? new Date(`${date}T00:00:00.000Z`) : new Date();
    if (Number.isNaN(base.getTime())) {
      throw new BadRequestException('Invalid date, expected YYYY-MM-DD');
    }
    const start = new Date(
      Date.UTC(
        base.getUTCFullYear(),
        base.getUTCMonth(),
        base.getUTCDate(),
        0,
        0,
        0,
        0,
      ),
    );
    const end = new Date(start.getTime() + 24 * 60 * 60 * 1000 - 1);
    return { start, end };
  }
}
