import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { col, fn, Op } from 'sequelize';
import { Project, PROJECT_COLORS } from './entities/project.entity';
import { Task } from '../tasks/entities/task.entity';
import { TimeEntry } from '../time-entries/entities/time-entry.entity';
import { WorkspacesService } from '../workspaces/workspaces.service';
import { WorkspaceRole } from '../workspaces/entities/workspace-member.entity';
import { AuditService } from '../audit/audit.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { ProjectWithStatsDto } from './dto/project-with-stats.dto';

@Injectable()
export class ProjectsService {
  constructor(
    @InjectModel(Project)
    private readonly projectModel: typeof Project,
    @InjectModel(Task)
    private readonly taskModel: typeof Task,
    @InjectModel(TimeEntry)
    private readonly timeEntryModel: typeof TimeEntry,
    private readonly workspacesService: WorkspacesService,
    private readonly auditService: AuditService,
  ) {}

  async create(userId: string, dto: CreateProjectDto): Promise<Project> {
    const ctx = await this.workspacesService.getContext(userId);
    if (!ctx.isAdmin) {
      throw new ForbiddenException('Управлять проектами может админ');
    }
    const project = await this.projectModel.create({
      user_id: userId,
      name: dto.name,
      color: dto.color ?? PROJECT_COLORS[0],
      archived: false,
    });
    this.auditService.log(
      ctx.workspace.id,
      userId,
      `создал(а) проект «${project.name}»`,
      { type: 'project', id: project.id },
    );
    return project;
  }

  /**
   * Список проектов со статистикой: число задач и затрекано за последние 7 дней.
   * Архивные включаются только по запросу (для отчётов).
   */
  async findAll(
    userId: string,
    opts: { includeArchived?: boolean } = {},
  ): Promise<ProjectWithStatsDto[]> {
    const ctx = await this.workspacesService.getContext(userId);
    // Проекты общие для всей команды (созданы любым её участником).
    const where: Record<string, unknown> = {
      user_id: { [Op.in]: ctx.memberIds },
    };
    if (!opts.includeArchived) {
      where.archived = false;
    }
    // PM и клиент видят только свой проект.
    if (ctx.role === WorkspaceRole.PM || ctx.role === WorkspaceRole.CLIENT) {
      where.id = ctx.project_id ?? '00000000-0000-0000-0000-000000000000';
    }
    const projects = await this.projectModel.findAll({
      where,
      order: [['created_at', 'ASC']],
    });
    if (projects.length === 0) return [];

    const projectIds = projects.map((p) => p.id);
    const weekStart = new Date(Date.now() - 6 * 24 * 60 * 60 * 1000);
    weekStart.setUTCHours(0, 0, 0, 0);

    const [taskCounts, weekRows] = await Promise.all([
      this.taskModel.findAll({
        attributes: ['project_id', [fn('COUNT', col('id')), 'cnt']],
        where: { project_id: { [Op.in]: projectIds } },
        group: ['project_id'],
        raw: true,
      }),
      this.timeEntryModel.findAll({
        attributes: [
          [col('task.project_id'), 'project_id'],
          [fn('COALESCE', fn('SUM', col('TimeEntry.duration_seconds')), 0), 'total'],
        ],
        where: {
          user_id: { [Op.in]: ctx.memberIds },
          started_at: { [Op.gte]: weekStart },
        },
        include: [
          {
            model: Task,
            attributes: [],
            required: true,
            where: { project_id: { [Op.in]: projectIds } },
          },
        ],
        group: ['task.project_id'],
        raw: true,
      }),
    ]);

    const countByProject = new Map<string, number>();
    for (const row of taskCounts as unknown as Array<{
      project_id: string;
      cnt: string | number;
    }>) {
      countByProject.set(row.project_id, Number(row.cnt) || 0);
    }

    const weekByProject = new Map<string, number>();
    for (const row of weekRows as unknown as Array<{
      project_id: string;
      total: string | number;
    }>) {
      weekByProject.set(row.project_id, Number(row.total) || 0);
    }

    return projects.map((p) => ({
      ...(p.toJSON() as Omit<
        ProjectWithStatsDto,
        'task_count' | 'week_tracked_seconds'
      >),
      task_count: countByProject.get(p.id) ?? 0,
      week_tracked_seconds: weekByProject.get(p.id) ?? 0,
    })) as ProjectWithStatsDto[];
  }

  /** Проект команды; мутации доступны только admin+. */
  private async findForMutation(userId: string, id: string): Promise<Project> {
    const ctx = await this.workspacesService.getContext(userId);
    if (!ctx.isAdmin) {
      throw new ForbiddenException('Управлять проектами может админ');
    }
    const project = await this.projectModel.findOne({
      where: { id, user_id: { [Op.in]: ctx.memberIds } },
    });
    if (!project) {
      throw new NotFoundException('Project not found');
    }
    return project;
  }

  async update(
    userId: string,
    id: string,
    dto: UpdateProjectDto,
  ): Promise<Project> {
    const project = await this.findForMutation(userId, id);
    if (dto.name !== undefined) project.name = dto.name;
    if (dto.color !== undefined) project.color = dto.color;
    if (dto.archived !== undefined && dto.archived !== project.archived) {
      project.archived = dto.archived;
      const ctx = await this.workspacesService.getContext(userId);
      this.auditService.log(
        ctx.workspace.id,
        userId,
        dto.archived
          ? `архивировал(а) проект «${project.name}»`
          : `вернул(а) проект «${project.name}» из архива`,
        { type: 'project', id: project.id },
      );
    }
    if (dto.hourly_rate !== undefined) project.hourly_rate = dto.hourly_rate;
    if (dto.weekly_budget_hours !== undefined) {
      project.weekly_budget_hours = dto.weekly_budget_hours;
    }
    return project.save();
  }

  /** Удаляет проект; задачи остаются без проекта (project_id = NULL). */
  async remove(userId: string, id: string): Promise<void> {
    const project = await this.findForMutation(userId, id);
    await this.taskModel.update(
      { project_id: null },
      { where: { project_id: id } },
    );
    await project.destroy();
  }
}
