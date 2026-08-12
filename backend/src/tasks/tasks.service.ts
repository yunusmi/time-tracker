import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { col, fn, Op } from 'sequelize';
import { Task, TaskStatus } from './entities/task.entity';
import { Project } from '../projects/entities/project.entity';
import { TimeEntry } from '../time-entries/entities/time-entry.entity';
import {
  PomodoroPhase,
  PomodoroSession,
} from '../pomodoro/entities/pomodoro-session.entity';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { TaskWithStatsDto } from './dto/task-with-stats.dto';

@Injectable()
export class TasksService {
  constructor(
    @InjectModel(Task)
    private readonly taskModel: typeof Task,
    @InjectModel(TimeEntry)
    private readonly timeEntryModel: typeof TimeEntry,
    @InjectModel(PomodoroSession)
    private readonly pomodoroSessionModel: typeof PomodoroSession,
    @InjectModel(Project)
    private readonly projectModel: typeof Project,
  ) {}

  /** Throws NotFoundException if the project does not belong to the user. */
  private async assertProjectOwnership(
    userId: string,
    projectId?: string | null,
  ): Promise<void> {
    if (!projectId) return;
    const project = await this.projectModel.findOne({
      where: { id: projectId, user_id: userId },
    });
    if (!project) {
      throw new NotFoundException('Project not found');
    }
  }

  async create(userId: string, dto: CreateTaskDto): Promise<Task> {
    await this.assertProjectOwnership(userId, dto.project_id);
    const task = await this.taskModel.create({
      title: dto.title,
      description: dto.description ?? null,
      status: dto.status ?? TaskStatus.TODO,
      estimated_minutes: dto.estimated_minutes ?? null,
      project_id: dto.project_id ?? null,
      user_id: userId,
      completed_at: dto.status === TaskStatus.DONE ? new Date() : null,
    });
    return (await task.reload({ include: [Project] })) as Task;
  }

  async findAll(userId: string): Promise<TaskWithStatsDto[]> {
    const tasks = await this.taskModel.findAll({
      where: { user_id: userId },
      include: [Project],
      order: [['created_at', 'DESC']],
    });
    return this.attachStats(userId, tasks);
  }

  /** Tasks marked done with a completed_at inside the given day. */
  async findCompletedForDay(
    userId: string,
    range: { start: Date; end: Date },
  ): Promise<TaskWithStatsDto[]> {
    const tasks = await this.taskModel.findAll({
      where: {
        user_id: userId,
        status: TaskStatus.DONE,
        completed_at: { [Op.between]: [range.start, range.end] },
      },
      include: [Project],
      order: [['completed_at', 'ASC']],
    });
    return this.attachStats(userId, tasks);
  }

  async findOne(userId: string, id: string): Promise<Task> {
    const task = await this.taskModel.findOne({
      where: { id, user_id: userId },
      include: [Project],
    });
    if (!task) {
      throw new NotFoundException('Task not found');
    }
    return task;
  }

  async update(userId: string, id: string, dto: UpdateTaskDto): Promise<Task> {
    const task = await this.findOne(userId, id);

    if (dto.status && dto.status !== task.status) {
      task.completed_at = dto.status === TaskStatus.DONE ? new Date() : null;
    }
    if (dto.title !== undefined) task.title = dto.title;
    if (dto.description !== undefined) task.description = dto.description;
    if (dto.status !== undefined) task.status = dto.status;
    if (dto.estimated_minutes !== undefined) {
      task.estimated_minutes = dto.estimated_minutes;
    }
    if (dto.project_id !== undefined) {
      await this.assertProjectOwnership(userId, dto.project_id);
      task.project_id = dto.project_id ?? null;
    }

    await task.save();
    return (await task.reload({ include: [Project] })) as Task;
  }

  async remove(userId: string, id: string): Promise<void> {
    const task = await this.findOne(userId, id);
    await task.destroy();
  }

  /** Merges tracked-time sums and pomodoro counts onto plain task objects. */
  private async attachStats(
    userId: string,
    tasks: Task[],
  ): Promise<TaskWithStatsDto[]> {
    if (tasks.length === 0) return [];
    const taskIds = tasks.map((t) => t.id);

    const [trackedRows, pomodoroRows] = await Promise.all([
      this.timeEntryModel.findAll({
        attributes: [
          'task_id',
          [fn('COALESCE', fn('SUM', col('duration_seconds')), 0), 'total'],
        ],
        where: { user_id: userId, task_id: { [Op.in]: taskIds } },
        group: ['task_id'],
        raw: true,
      }),
      this.pomodoroSessionModel.findAll({
        attributes: ['task_id', [fn('COUNT', col('id')), 'cnt']],
        where: {
          user_id: userId,
          task_id: { [Op.in]: taskIds },
          phase: PomodoroPhase.WORK,
          completed: true,
        },
        group: ['task_id'],
        raw: true,
      }),
    ]);

    const trackedByTask = new Map<string, number>();
    for (const row of trackedRows as unknown as Array<{
      task_id: string;
      total: string | number;
    }>) {
      trackedByTask.set(row.task_id, Number(row.total) || 0);
    }

    const pomodoroByTask = new Map<string, number>();
    for (const row of pomodoroRows as unknown as Array<{
      task_id: string;
      cnt: string | number;
    }>) {
      pomodoroByTask.set(row.task_id, Number(row.cnt) || 0);
    }

    return tasks.map((task) => ({
      ...(task.toJSON() as Omit<
        TaskWithStatsDto,
        'total_tracked_seconds' | 'pomodoro_count'
      >),
      total_tracked_seconds: trackedByTask.get(task.id) ?? 0,
      pomodoro_count: pomodoroByTask.get(task.id) ?? 0,
    }));
  }
}
