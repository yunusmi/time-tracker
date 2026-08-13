import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { col, fn, Op, WhereOptions } from 'sequelize';
import { Task, TaskStatus } from './entities/task.entity';
import { Project } from '../projects/entities/project.entity';
import { User } from '../users/entities/user.entity';
import { TimeEntry } from '../time-entries/entities/time-entry.entity';
import {
  PomodoroPhase,
  PomodoroSession,
} from '../pomodoro/entities/pomodoro-session.entity';
import {
  WorkspaceContext,
  WorkspacesService,
} from '../workspaces/workspaces.service';
import { WorkspaceRole } from '../workspaces/entities/workspace-member.entity';
import { AuditService } from '../audit/audit.service';
import { NotificationsService } from '../notifications/notifications.service';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { TaskWithStatsDto } from './dto/task-with-stats.dto';

const TASK_INCLUDES = [
  Project,
  { model: User, as: 'assignee', attributes: ['id', 'name', 'email'] },
];

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
    private readonly workspacesService: WorkspacesService,
    private readonly auditService: AuditService,
    private readonly notificationsService: NotificationsService,
  ) {}

  /** Throws NotFoundException if the project does not belong to the workspace admins/creator. */
  private async assertProjectOwnership(
    ctx: WorkspaceContext,
    userId: string,
    projectId?: string | null,
  ): Promise<void> {
    if (!projectId) return;
    const project = await this.projectModel.findOne({
      where: {
        id: projectId,
        user_id: { [Op.in]: ctx.memberIds },
      },
    });
    if (!project) {
      throw new NotFoundException('Project not found');
    }
    // PM работает только со своим проектом.
    if (ctx.role === WorkspaceRole.PM && projectId !== ctx.project_id) {
      throw new ForbiddenException('Менеджеру доступен только свой проект');
    }
  }

  /** Условие видимости задач для роли. */
  private visibilityWhere(ctx: WorkspaceContext, userId: string): WhereOptions {
    if (ctx.isAdmin) {
      // Все задачи участников workspace (старые записи без assignee — по создателю).
      return {
        [Op.or]: [
          { assignee_id: { [Op.in]: ctx.memberIds } },
          { assignee_id: { [Op.is]: null }, user_id: { [Op.in]: ctx.memberIds } },
        ],
      };
    }
    if (ctx.role === WorkspaceRole.PM) {
      return { project_id: ctx.project_id ?? '00000000-0000-0000-0000-000000000000' };
    }
    // member: только свои (assignee = я; старые без assignee — по создателю).
    return {
      [Op.or]: [
        { assignee_id: userId },
        { assignee_id: { [Op.is]: null }, user_id: userId },
      ],
    };
  }

  async create(userId: string, dto: CreateTaskDto): Promise<Task> {
    const ctx = await this.workspacesService.getContext(userId);
    if (ctx.role === WorkspaceRole.CLIENT) {
      throw new ForbiddenException('Клиенту недоступно создание задач');
    }
    await this.assertProjectOwnership(ctx, userId, dto.project_id);

    // Назначать других может admin+; остальные создают себе.
    let assigneeId = userId;
    if (dto.assignee_id && dto.assignee_id !== userId) {
      if (!ctx.isAdmin) {
        throw new ForbiddenException('Назначать задачи может админ');
      }
      if (!ctx.memberIds.includes(dto.assignee_id)) {
        throw new NotFoundException('Исполнитель не найден в команде');
      }
      assigneeId = dto.assignee_id;
    }

    const task = await this.taskModel.create({
      title: dto.title,
      description: dto.description ?? null,
      status: dto.status ?? TaskStatus.TODO,
      estimated_minutes: dto.estimated_minutes ?? null,
      project_id: dto.project_id ?? null,
      assignee_id: assigneeId,
      priority: dto.priority ?? 'med',
      due_date: dto.due_date ?? null,
      user_id: userId,
      completed_at: dto.status === TaskStatus.DONE ? new Date() : null,
    });

    this.auditService.log(
      ctx.workspace.id,
      userId,
      `создал(а) задачу «${task.title}»`,
      { type: 'task', id: task.id },
    );
    if (assigneeId !== userId) {
      this.notificationsService.notify(
        assigneeId,
        `Новая задача от админа: «${task.title}»`,
      );
    }

    return (await task.reload({ include: TASK_INCLUDES })) as Task;
  }

  /**
   * Список задач по роли: admin+ видит все задачи команды (опц. only=mine),
   * member — только свои, pm — задачи своего проекта.
   */
  async findAll(
    userId: string,
    opts: { who?: 'all' | 'mine' } = {},
  ): Promise<TaskWithStatsDto[]> {
    const ctx = await this.workspacesService.getContext(userId);
    if (ctx.role === WorkspaceRole.CLIENT) {
      return [];
    }
    let where = this.visibilityWhere(ctx, userId);
    if (ctx.isAdmin && opts.who === 'mine') {
      where = {
        [Op.or]: [
          { assignee_id: userId },
          { assignee_id: { [Op.is]: null }, user_id: userId },
        ],
      };
    }
    const tasks = await this.taskModel.findAll({
      where,
      include: TASK_INCLUDES,
      order: [['created_at', 'DESC']],
    });
    return this.attachStats(tasks);
  }

  /** Tasks marked done with a completed_at inside the given day (для экспорта). */
  async findCompletedForDay(
    userId: string,
    range: { start: Date; end: Date },
  ): Promise<TaskWithStatsDto[]> {
    const tasks = await this.taskModel.findAll({
      where: {
        [Op.and]: [
          {
            [Op.or]: [
              { assignee_id: userId },
              { assignee_id: { [Op.is]: null }, user_id: userId },
            ],
          },
          {
            status: TaskStatus.DONE,
            completed_at: { [Op.between]: [range.start, range.end] },
          },
        ],
      },
      include: TASK_INCLUDES,
      order: [['completed_at', 'ASC']],
    });
    return this.attachStats(tasks);
  }

  /** Задача, доступная пользователю по его роли (иначе 404/403). */
  async findOne(userId: string, id: string): Promise<Task> {
    const ctx = await this.workspacesService.getContext(userId);
    const task = await this.taskModel.findOne({
      where: { id, ...(this.visibilityWhere(ctx, userId) as object) },
      include: TASK_INCLUDES,
    });
    if (!task) {
      throw new NotFoundException('Task not found');
    }
    return task;
  }

  async update(userId: string, id: string, dto: UpdateTaskDto): Promise<Task> {
    const ctx = await this.workspacesService.getContext(userId);
    if (ctx.role === WorkspaceRole.CLIENT) {
      throw new ForbiddenException('Клиенту недоступно изменение задач');
    }
    const task = await this.findOne(userId, id);

    if (dto.status && dto.status !== task.status) {
      task.completed_at = dto.status === TaskStatus.DONE ? new Date() : null;
      this.auditService.log(
        ctx.workspace.id,
        userId,
        `изменил(а) статус «${task.title}» → ${
          { todo: 'К работе', in_progress: 'В работе', done: 'Готово' }[dto.status]
        }`,
        { type: 'task', id: task.id },
      );
    }
    if (dto.title !== undefined) task.title = dto.title;
    if (dto.description !== undefined) task.description = dto.description;
    if (dto.status !== undefined) task.status = dto.status;
    if (dto.estimated_minutes !== undefined) {
      task.estimated_minutes = dto.estimated_minutes;
    }
    if (dto.priority !== undefined) task.priority = dto.priority;
    if (dto.due_date !== undefined) task.due_date = dto.due_date ?? null;
    if (dto.project_id !== undefined) {
      await this.assertProjectOwnership(ctx, userId, dto.project_id);
      task.project_id = dto.project_id ?? null;
    }
    if (dto.assignee_id !== undefined) {
      if (!ctx.isAdmin) {
        throw new ForbiddenException('Назначать задачи может админ');
      }
      if (dto.assignee_id && !ctx.memberIds.includes(dto.assignee_id)) {
        throw new NotFoundException('Исполнитель не найден в команде');
      }
      const next = dto.assignee_id ?? userId;
      if (next !== task.assignee_id && next !== userId) {
        this.notificationsService.notify(
          next,
          `Новая задача от админа: «${task.title}»`,
        );
      }
      task.assignee_id = next;
    }

    await task.save();
    return (await task.reload({ include: TASK_INCLUDES })) as Task;
  }

  async remove(userId: string, id: string): Promise<void> {
    const ctx = await this.workspacesService.getContext(userId);
    if (ctx.role === WorkspaceRole.CLIENT) {
      throw new ForbiddenException('Клиенту недоступно удаление задач');
    }
    const task = await this.findOne(userId, id);
    await task.destroy();
    this.auditService.log(
      ctx.workspace.id,
      userId,
      `удалил(а) задачу «${task.title}»`,
      { type: 'task', id: task.id },
    );
  }

  /** Merges tracked-time sums and pomodoro counts onto plain task objects. */
  private async attachStats(tasks: Task[]): Promise<TaskWithStatsDto[]> {
    if (tasks.length === 0) return [];
    const taskIds = tasks.map((t) => t.id);

    const [trackedRows, pomodoroRows] = await Promise.all([
      this.timeEntryModel.findAll({
        attributes: [
          'task_id',
          [fn('COALESCE', fn('SUM', col('duration_seconds')), 0), 'total'],
        ],
        where: { task_id: { [Op.in]: taskIds } },
        group: ['task_id'],
        raw: true,
      }),
      this.pomodoroSessionModel.findAll({
        attributes: ['task_id', [fn('COUNT', col('id')), 'cnt']],
        where: {
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
