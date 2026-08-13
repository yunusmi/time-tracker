import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { randomBytes } from 'crypto';
import { Op } from 'sequelize';
import { ReportShare } from './report-share.entity';
import { TimeEntry } from '../time-entries/entities/time-entry.entity';
import { Task } from '../tasks/entities/task.entity';
import { Project } from '../projects/entities/project.entity';
import { User } from '../users/entities/user.entity';
import { WorkspacesService } from '../workspaces/workspaces.service';
import { dayRange } from '../common/day-range';

export interface InvoiceRow {
  task_title: string;
  hours: number;
  rate: number;
  sum: number;
}

@Injectable()
export class ReportsService {
  constructor(
    @InjectModel(ReportShare)
    private readonly shareModel: typeof ReportShare,
    @InjectModel(TimeEntry)
    private readonly timeEntryModel: typeof TimeEntry,
    @InjectModel(Project)
    private readonly projectModel: typeof Project,
    @InjectModel(User)
    private readonly userModel: typeof User,
    private readonly workspacesService: WorkspacesService,
  ) {}

  /** Превью счёта: billable-часы задач проекта × ставка за период. */
  async invoicePreview(
    userId: string,
    from: string,
    to: string,
    projectId?: string,
  ): Promise<{
    number: string;
    period: { from: string; to: string };
    project_name: string;
    rows: InvoiceRow[];
    total: number;
  }> {
    const ctx = await this.workspacesService.getContext(userId);
    if (!ctx.isAdmin) {
      throw new ForbiddenException('Счета доступны только админу');
    }
    const start = dayRange(from).start;
    const end = dayRange(to).end;

    const project = projectId
      ? await this.projectModel.findByPk(projectId)
      : null;
    const entries = await this.timeEntryModel.findAll({
      where: {
        user_id: { [Op.in]: ctx.memberIds },
        started_at: { [Op.between]: [start, end] },
        billable: { [Op.ne]: false },
      },
      include: [{ model: Task, include: [Project], required: true }],
    });

    const byTask = new Map<string, { title: string; seconds: number; rate: number }>();
    for (const e of entries) {
      const task = e.task;
      if (!task?.project_id) continue;
      if (projectId && task.project_id !== projectId) continue;
      const rate = task.project?.hourly_rate ?? 0;
      const cur = byTask.get(task.id) ?? { title: task.title, seconds: 0, rate };
      cur.seconds += e.duration_seconds;
      byTask.set(task.id, cur);
    }

    let total = 0;
    const rows: InvoiceRow[] = [...byTask.values()]
      .map((t) => {
        const hours = t.seconds / 3600;
        const sum = hours * t.rate;
        total += sum;
        return {
          task_title: t.title,
          hours: Math.round(hours * 10) / 10,
          rate: t.rate,
          sum: Math.round(sum),
        };
      })
      .sort((a, b) => b.sum - a.sum);

    return {
      number: `INV-${from.slice(5).replace('-', '')}`,
      period: { from, to },
      project_name: project?.name ?? 'Все проекты',
      rows,
      total: Math.round(total),
    };
  }

  /** Публичная ссылка на отчёт: get-or-create для проекта (admin+). */
  async getOrCreateShare(
    userId: string,
    projectId?: string | null,
  ): Promise<ReportShare> {
    const ctx = await this.workspacesService.getContext(userId);
    if (!ctx.isAdmin) {
      throw new ForbiddenException('Публичные ссылки доступны только админу');
    }
    const [share] = await this.shareModel.findOrCreate({
      where: {
        workspace_id: ctx.workspace.id,
        project_id: projectId ?? null,
      },
      defaults: {
        workspace_id: ctx.workspace.id,
        user_id: userId,
        project_id: projectId ?? null,
        token: randomBytes(16).toString('hex'),
        active: true,
      },
    });
    return share;
  }

  async updateShare(
    userId: string,
    id: string,
    patch: Partial<{ active: boolean; hide_money: boolean; hide_names: boolean }>,
  ): Promise<ReportShare> {
    const ctx = await this.workspacesService.getContext(userId);
    if (!ctx.isAdmin) {
      throw new ForbiddenException('Публичные ссылки доступны только админу');
    }
    const share = await this.shareModel.findOne({
      where: { id, workspace_id: ctx.workspace.id },
    });
    if (!share) {
      throw new NotFoundException('Ссылка не найдена');
    }
    if (patch.active !== undefined) share.active = patch.active;
    if (patch.hide_money !== undefined) share.hide_money = patch.hide_money;
    if (patch.hide_names !== undefined) share.hide_names = patch.hide_names;
    return share.save();
  }

  /**
   * Отчёт по проекту для ролей client/pm: агрегаты недели всей команды
   * по привязанному проекту (клиент — без денег и имён по умолчанию с деньгами скрытыми).
   */
  async myProjectReport(userId: string) {
    const ctx = await this.workspacesService.getContext(userId);
    if (!ctx.project_id) {
      throw new NotFoundException('К вашей роли не привязан проект');
    }
    return this.buildProjectReport(ctx.workspace.id, ctx.project_id, {
      // «Менеджер/клиент — без денег» (ТЗ RBAC).
      hideMoney: true,
      hideNames: ctx.role === 'client',
    });
  }

  /** Публичный отчёт по токену: неделя проекта, с учётом hide_money/hide_names. */
  async publicReport(token: string) {
    const share = await this.shareModel.findOne({ where: { token } });
    if (!share || !share.active) {
      throw new NotFoundException('Ссылка недействительна или выключена');
    }
    return this.buildProjectReport(share.workspace_id, share.project_id, {
      hideMoney: share.hide_money,
      hideNames: share.hide_names,
    });
  }

  /** Общий построитель проектного отчёта за последнюю неделю. */
  private async buildProjectReport(
    workspaceId: string,
    projectId: string | null,
    opts: { hideMoney: boolean; hideNames: boolean },
  ) {
    const memberIds = (
      await this.workspacesService.getMembers(workspaceId)
    ).map((m) => m.user_id);

    const to = new Date().toISOString().slice(0, 10);
    const from = new Date(Date.now() - 6 * 86_400_000).toISOString().slice(0, 10);
    const start = dayRange(from).start;
    const end = dayRange(to).end;

    const project = projectId
      ? await this.projectModel.findByPk(projectId)
      : null;

    const entries = await this.timeEntryModel.findAll({
      where: {
        user_id: { [Op.in]: memberIds },
        started_at: { [Op.between]: [start, end] },
      },
      include: [{ model: Task, include: [Project], required: !!projectId }],
    });
    const filtered = projectId
      ? entries.filter((e) => e.task?.project_id === projectId)
      : entries;

    const users = opts.hideNames
      ? []
      : await this.userModel.findAll({
          where: { id: { [Op.in]: memberIds } },
        });

    const byDay = new Map<string, number>();
    const byTask = new Map<string, { title: string; seconds: number; billable: number }>();
    const byUser = new Map<string, number>();
    let totalBillable = 0;
    for (const e of filtered) {
      const day = e.started_at.toISOString().slice(0, 10);
      byDay.set(day, (byDay.get(day) ?? 0) + e.duration_seconds);
      byUser.set(e.user_id, (byUser.get(e.user_id) ?? 0) + e.duration_seconds);
      if (e.billable !== false) totalBillable += e.duration_seconds;
      if (e.task) {
        const t = byTask.get(e.task.id) ?? {
          title: e.task.title,
          seconds: 0,
          billable: 0,
        };
        t.seconds += e.duration_seconds;
        if (e.billable !== false) t.billable += e.duration_seconds;
        byTask.set(e.task.id, t);
      }
    }

    const rate = project?.hourly_rate ?? 0;
    return {
      project_name: project?.name ?? 'Все проекты',
      project_color: project?.color ?? null,
      period: { from, to },
      days: [...byDay.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([date, seconds]) => ({ date, seconds })),
      tasks: [...byTask.values()]
        .sort((a, b) => b.seconds - a.seconds)
        .slice(0, 10)
        .map((t) => ({ title: t.title, seconds: t.seconds })),
      members: opts.hideNames
        ? []
        : [...byUser.entries()].map(([id, seconds]) => ({
            name: users.find((u) => u.id === id)?.name ?? '—',
            seconds,
          })),
      total_seconds: filtered.reduce((s, e) => s + e.duration_seconds, 0),
      money: opts.hideMoney ? null : Math.round((totalBillable / 3600) * rate),
    };
  }
}
