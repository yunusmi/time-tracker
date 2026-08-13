import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { col, fn, Op } from 'sequelize';
import { Timesheet, TimesheetStatus } from './entities/timesheet.entity';
import { TimeEntry } from '../time-entries/entities/time-entry.entity';
import { User } from '../users/entities/user.entity';
import { WorkspacesService } from '../workspaces/workspaces.service';
import { AuditService } from '../audit/audit.service';
import { NotificationsService } from '../notifications/notifications.service';
import { StandupService } from '../reports/standup.service';

export interface TimesheetView {
  id: string | null;
  user_id: string;
  user_name: string;
  week_start: string;
  status: TimesheetStatus;
  comment: string | null;
  summary: string | null;
  total_seconds: number;
}

@Injectable()
export class TimesheetsService {
  constructor(
    @InjectModel(Timesheet)
    private readonly timesheetModel: typeof Timesheet,
    @InjectModel(TimeEntry)
    private readonly timeEntryModel: typeof TimeEntry,
    @InjectModel(User)
    private readonly userModel: typeof User,
    private readonly workspacesService: WorkspacesService,
    private readonly auditService: AuditService,
    private readonly notificationsService: NotificationsService,
    private readonly standupService: StandupService,
  ) {}

  /** Понедельник недели (UTC) для даты; по умолчанию — текущей. */
  static weekStartOf(date?: string): string {
    const base = date ? new Date(`${date}T00:00:00.000Z`) : new Date();
    if (Number.isNaN(base.getTime())) {
      throw new BadRequestException('Invalid week date, expected YYYY-MM-DD');
    }
    const day = base.getUTCDay(); // 0 = вс
    const diff = day === 0 ? 6 : day - 1;
    const monday = new Date(
      Date.UTC(base.getUTCFullYear(), base.getUTCMonth(), base.getUTCDate() - diff),
    );
    return monday.toISOString().slice(0, 10);
  }

  private static weekRange(weekStart: string): { start: Date; end: Date } {
    const start = new Date(`${weekStart}T00:00:00.000Z`);
    const end = new Date(start.getTime() + 7 * 24 * 60 * 60 * 1000 - 1);
    return { start, end };
  }

  /** Суммы затреканного за неделю по каждому пользователю. */
  private async weekTotals(
    userIds: string[],
    weekStart: string,
  ): Promise<Map<string, number>> {
    const { start, end } = TimesheetsService.weekRange(weekStart);
    const rows = await this.timeEntryModel.findAll({
      attributes: [
        'user_id',
        [fn('COALESCE', fn('SUM', col('duration_seconds')), 0), 'total'],
      ],
      where: {
        user_id: { [Op.in]: userIds },
        started_at: { [Op.between]: [start, end] },
      },
      group: ['user_id'],
      raw: true,
    });
    const map = new Map<string, number>();
    for (const r of rows as unknown as Array<{
      user_id: string;
      total: string | number;
    }>) {
      map.set(r.user_id, Number(r.total) || 0);
    }
    return map;
  }

  /** Мой таймшит недели + (admin) таймшиты команды. */
  async list(
    userId: string,
    week?: string,
  ): Promise<{ week_start: string; mine: TimesheetView; team: TimesheetView[] }> {
    const ctx = await this.workspacesService.getContext(userId);
    const weekStart = TimesheetsService.weekStartOf(week);

    const sheets = await this.timesheetModel.findAll({
      where: {
        workspace_id: ctx.workspace.id,
        week_start: weekStart,
        user_id: { [Op.in]: ctx.memberIds },
      },
    });
    const users = await this.userModel.findAll({
      where: { id: { [Op.in]: ctx.memberIds } },
    });
    const totals = await this.weekTotals(ctx.memberIds, weekStart);

    const view = (uid: string): TimesheetView => {
      const sheet = sheets.find((s) => s.user_id === uid);
      const user = users.find((u) => u.id === uid);
      return {
        id: sheet?.id ?? null,
        user_id: uid,
        user_name: user?.name ?? '',
        week_start: weekStart,
        status: sheet?.status ?? TimesheetStatus.DRAFT,
        comment: sheet?.comment ?? null,
        summary: sheet?.summary ?? null,
        total_seconds: totals.get(uid) ?? 0,
      };
    };

    return {
      week_start: weekStart,
      mine: view(userId),
      team: ctx.isAdmin
        ? ctx.memberIds.filter((id) => id !== userId).map(view)
        : [],
    };
  }

  /** Отправить свою неделю на проверку. */
  async submit(userId: string, week?: string): Promise<Timesheet> {
    const ctx = await this.workspacesService.getContext(userId);
    const weekStart = TimesheetsService.weekStartOf(week);
    const [sheet] = await this.timesheetModel.findOrCreate({
      where: { user_id: userId, week_start: weekStart },
      defaults: {
        user_id: userId,
        workspace_id: ctx.workspace.id,
        week_start: weekStart,
        status: TimesheetStatus.DRAFT,
      },
    });
    if (sheet.status === TimesheetStatus.APPROVED) {
      throw new BadRequestException('Неделя уже утверждена');
    }
    if (sheet.status === TimesheetStatus.PENDING) {
      throw new BadRequestException('Таймшит уже на проверке');
    }
    sheet.status = TimesheetStatus.PENDING;
    sheet.comment = null;
    // Авто-сводка недели прикладывается при отправке (ТЗ, п. 46).
    try {
      sheet.summary = await this.standupService.buildWeekSummary(
        userId,
        weekStart,
      );
    } catch {
      sheet.summary = null;
    }
    await sheet.save();
    return sheet;
  }

  /** Утвердить/вернуть таймшит (admin+). */
  async review(
    adminId: string,
    id: string,
    action: 'approve' | 'return',
    comment?: string,
  ): Promise<Timesheet> {
    const ctx = await this.workspacesService.getContext(adminId);
    if (!ctx.isAdmin) {
      throw new ForbiddenException('Утверждать таймшиты может админ');
    }
    const sheet = await this.timesheetModel.findOne({
      where: { id, workspace_id: ctx.workspace.id },
    });
    if (!sheet) {
      throw new NotFoundException('Таймшит не найден');
    }
    const owner = await this.userModel.findByPk(sheet.user_id);
    const weekLabel = sheet.week_start;
    if (action === 'approve') {
      sheet.status = TimesheetStatus.APPROVED;
      sheet.approved_by = adminId;
      sheet.comment = null;
      this.auditService.log(
        ctx.workspace.id,
        adminId,
        `утвердил(а) таймшит — ${owner?.name ?? ''} (${weekLabel})`,
        { type: 'timesheet', id: sheet.id },
      );
      this.notificationsService.notify(
        sheet.user_id,
        `Ваш таймшит за неделю ${weekLabel} утверждён`,
        'green',
      );
    } else {
      sheet.status = TimesheetStatus.RETURNED;
      sheet.comment = comment ?? null;
      this.auditService.log(
        ctx.workspace.id,
        adminId,
        `вернул(а) таймшит ${owner?.name ?? ''} на доработку`,
        { type: 'timesheet', id: sheet.id },
      );
      this.notificationsService.notify(
        sheet.user_id,
        `Таймшит за неделю ${weekLabel} возвращён на доработку${comment ? `: ${comment}` : ''}`,
        'red',
      );
    }
    await sheet.save();
    return sheet;
  }

  /** Массовое утверждение всех pending за неделю (admin+). */
  async approveAll(
    adminId: string,
    week?: string,
  ): Promise<{ approved: number }> {
    const ctx = await this.workspacesService.getContext(adminId);
    if (!ctx.isAdmin) {
      throw new ForbiddenException('Утверждать таймшиты может админ');
    }
    const weekStart = TimesheetsService.weekStartOf(week);
    const pending = await this.timesheetModel.findAll({
      where: {
        workspace_id: ctx.workspace.id,
        week_start: weekStart,
        status: TimesheetStatus.PENDING,
      },
    });
    const [count] = await this.timesheetModel.update(
      { status: TimesheetStatus.APPROVED, approved_by: adminId, comment: null },
      {
        where: {
          workspace_id: ctx.workspace.id,
          week_start: weekStart,
          status: TimesheetStatus.PENDING,
        },
      },
    );
    this.auditService.log(
      ctx.workspace.id,
      adminId,
      `утвердил(а) все таймшиты недели ${weekStart} (${count})`,
      { type: 'timesheet' },
    );
    for (const sheet of pending) {
      this.notificationsService.notify(
        sheet.user_id,
        `Ваш таймшит за неделю ${weekStart} утверждён`,
        'green',
      );
    }
    return { approved: count };
  }

  /** Заблокирована ли (утверждена) неделя, в которую попадает дата. */
  async isWeekLocked(userId: string, date: Date): Promise<boolean> {
    const weekStart = TimesheetsService.weekStartOf(
      date.toISOString().slice(0, 10),
    );
    const sheet = await this.timesheetModel.findOne({
      where: {
        user_id: userId,
        week_start: weekStart,
        status: TimesheetStatus.APPROVED,
      },
    });
    return !!sheet;
  }
}
