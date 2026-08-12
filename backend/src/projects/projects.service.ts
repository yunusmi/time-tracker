import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { col, fn, Op } from 'sequelize';
import { Project, PROJECT_COLORS } from './entities/project.entity';
import { Task } from '../tasks/entities/task.entity';
import { TimeEntry } from '../time-entries/entities/time-entry.entity';
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
  ) {}

  create(userId: string, dto: CreateProjectDto): Promise<Project> {
    return this.projectModel.create({
      user_id: userId,
      name: dto.name,
      color: dto.color ?? PROJECT_COLORS[0],
      archived: false,
    });
  }

  /**
   * Список проектов со статистикой: число задач и затрекано за последние 7 дней.
   * Архивные включаются только по запросу (для отчётов).
   */
  async findAll(
    userId: string,
    opts: { includeArchived?: boolean } = {},
  ): Promise<ProjectWithStatsDto[]> {
    const where: Record<string, unknown> = { user_id: userId };
    if (!opts.includeArchived) {
      where.archived = false;
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
        where: { user_id: userId, project_id: { [Op.in]: projectIds } },
        group: ['project_id'],
        raw: true,
      }),
      this.timeEntryModel.findAll({
        attributes: [
          [col('task.project_id'), 'project_id'],
          [fn('COALESCE', fn('SUM', col('TimeEntry.duration_seconds')), 0), 'total'],
        ],
        where: {
          user_id: userId,
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

  async findOne(userId: string, id: string): Promise<Project> {
    const project = await this.projectModel.findOne({
      where: { id, user_id: userId },
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
    const project = await this.findOne(userId, id);
    if (dto.name !== undefined) project.name = dto.name;
    if (dto.color !== undefined) project.color = dto.color;
    if (dto.archived !== undefined) project.archived = dto.archived;
    return project.save();
  }

  /** Удаляет проект; задачи остаются без проекта (project_id = NULL). */
  async remove(userId: string, id: string): Promise<void> {
    const project = await this.findOne(userId, id);
    await this.taskModel.update(
      { project_id: null },
      { where: { user_id: userId, project_id: id } },
    );
    await project.destroy();
  }
}
