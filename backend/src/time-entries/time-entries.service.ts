import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Op } from 'sequelize';
import { TimeEntry } from './entities/time-entry.entity';
import { Task } from '../tasks/entities/task.entity';
import { StartTimerDto } from './dto/start-timer.dto';
import { CreateManualEntryDto } from './dto/create-manual-entry.dto';
import { UpdateTimeEntryDto } from './dto/update-time-entry.dto';
import { TasksService } from '../tasks/tasks.service';

@Injectable()
export class TimeEntriesService {
  constructor(
    @InjectModel(TimeEntry)
    private readonly timeEntryModel: typeof TimeEntry,
    private readonly tasksService: TasksService,
  ) {}

  private async assertTaskOwnership(
    userId: string,
    taskId?: string | null,
  ): Promise<void> {
    if (taskId) {
      // Throws NotFoundException if the task does not belong to the user.
      await this.tasksService.findOne(userId, taskId);
    }
  }

  getActive(userId: string): Promise<TimeEntry | null> {
    return this.timeEntryModel.findOne({
      where: { user_id: userId, ended_at: { [Op.is]: null } },
      include: [Task],
    });
  }

  async start(userId: string, dto: StartTimerDto): Promise<TimeEntry> {
    await this.assertTaskOwnership(userId, dto.task_id);

    // Clockify-style: starting a new timer stops the running one.
    const running = await this.getActive(userId);
    if (running) {
      await this.finishEntry(running);
    }

    return this.timeEntryModel.create({
      user_id: userId,
      task_id: dto.task_id ?? null,
      description: dto.description ?? null,
      started_at: new Date(),
      ended_at: null,
      duration_seconds: 0,
      is_manual: false,
    });
  }

  async stop(userId: string): Promise<TimeEntry> {
    const running = await this.getActive(userId);
    if (!running) {
      throw new BadRequestException('No timer is currently running');
    }
    return this.finishEntry(running);
  }

  private finishEntry(entry: TimeEntry): Promise<TimeEntry> {
    const endedAt = new Date();
    entry.ended_at = endedAt;
    entry.duration_seconds = Math.max(
      0,
      Math.round((endedAt.getTime() - entry.started_at.getTime()) / 1000),
    );
    return entry.save();
  }

  async createManual(
    userId: string,
    dto: CreateManualEntryDto,
  ): Promise<TimeEntry> {
    await this.assertTaskOwnership(userId, dto.task_id);

    const startedAt = new Date(dto.started_at);
    const endedAt = new Date(dto.ended_at);
    if (endedAt.getTime() <= startedAt.getTime()) {
      throw new BadRequestException('ended_at must be after started_at');
    }
    const durationSeconds = Math.round(
      (endedAt.getTime() - startedAt.getTime()) / 1000,
    );

    return this.timeEntryModel.create({
      user_id: userId,
      task_id: dto.task_id ?? null,
      description: dto.description ?? null,
      started_at: startedAt,
      ended_at: endedAt,
      duration_seconds: durationSeconds,
      is_manual: true,
    });
  }

  findAll(
    userId: string,
    filters: { date?: string; task_id?: string },
  ): Promise<TimeEntry[]> {
    const where: Record<string, unknown> = { user_id: userId };
    if (filters.task_id) {
      where.task_id = filters.task_id;
    }
    if (filters.date) {
      const { start, end } = TimeEntriesService.dayRange(filters.date);
      where.started_at = { [Op.between]: [start, end] };
    }
    return this.timeEntryModel.findAll({
      where,
      include: [Task],
      order: [['started_at', 'DESC']],
    });
  }

  /** Entries that started within the given day (default: today). */
  findForDay(userId: string, date?: string): Promise<TimeEntry[]> {
    const { start, end } = TimeEntriesService.dayRange(date);
    return this.timeEntryModel.findAll({
      where: { user_id: userId, started_at: { [Op.between]: [start, end] } },
      include: [Task],
      order: [['started_at', 'ASC']],
    });
  }

  async findOne(userId: string, id: string): Promise<TimeEntry> {
    const entry = await this.timeEntryModel.findOne({
      where: { id, user_id: userId },
      include: [Task],
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
