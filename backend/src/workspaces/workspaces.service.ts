import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { randomBytes } from 'crypto';
import { Op, WhereOptions } from 'sequelize';
import { Workspace } from './entities/workspace.entity';
import {
  ADMIN_ROLES,
  WorkspaceMember,
  WorkspaceRole,
} from './entities/workspace-member.entity';

/** Контекст текущего пользователя в его workspace для RBAC-проверок. */
export interface WorkspaceContext {
  workspace: Workspace;
  role: WorkspaceRole;
  /** Проект, к которому привязаны роли pm/client (иначе null). */
  project_id: string | null;
  /** id всех участников workspace (для admin-выборок «все сотрудники»). */
  memberIds: string[];
  isAdmin: boolean;
}

/**
 * Условие изоляции по компании для projects/tasks/time_entries.
 * Записи, созданные до появления workspace_id, относим к компании по автору —
 * иначе старые данные пропали бы из выдачи.
 */
export function workspaceScope(ctx: WorkspaceContext): WhereOptions {
  return {
    [Op.or]: [
      { workspace_id: ctx.workspace.id },
      {
        workspace_id: { [Op.is]: null },
        user_id: { [Op.in]: ctx.memberIds },
      },
    ],
  };
}

/**
 * Условие изоляции для агрегатов по записям времени: записи компании плюс
 * «старые» без workspace_id.
 */
export function entryScope(workspaceId: string): WhereOptions {
  return {
    [Op.or]: [
      { workspace_id: workspaceId },
      { workspace_id: { [Op.is]: null } },
    ],
  };
}

/** Строка переключателя компаний в сайдбаре. */
export interface WorkspaceListItem {
  id: string;
  name: string;
  brand_color: string;
  logo_url: string | null;
  role: WorkspaceRole;
  active: boolean;
}
import {
  InviteStatus,
  WorkspaceInvite,
} from './entities/workspace-invite.entity';
import { User } from '../users/entities/user.entity';
import { UserSettings } from '../users/entities/user-settings.entity';
import { Task } from '../tasks/entities/task.entity';
import { TimeEntry } from '../time-entries/entities/time-entry.entity';
import { dayRange } from '../common/day-range';
import { MailService } from '../mail/mail.service';
import { AuditService } from '../audit/audit.service';
import { Department } from './entities/department.entity';
import { Absence, AbsenceKind } from './entities/absence.entity';
import { PayKind } from './entities/workspace-member.entity';
import {
  CreateInviteDto,
  UpdateMemberDto,
  UpdateWorkspaceDto,
  WorkspaceMemberViewDto,
} from './dto/workspaces.dto';

const ROLE_LABELS: Record<string, string> = {
  owner: 'Владелец',
  admin: 'Админ',
  pm: 'Менеджер проекта',
  member: 'Участник',
  client: 'Клиент',
};

@Injectable()
export class WorkspacesService {
  constructor(
    @InjectModel(Workspace)
    private readonly workspaceModel: typeof Workspace,
    @InjectModel(WorkspaceMember)
    private readonly memberModel: typeof WorkspaceMember,
    @InjectModel(WorkspaceInvite)
    private readonly inviteModel: typeof WorkspaceInvite,
    @InjectModel(User)
    private readonly userModel: typeof User,
    @InjectModel(TimeEntry)
    private readonly timeEntryModel: typeof TimeEntry,
    @InjectModel(Department)
    private readonly departmentModel: typeof Department,
    @InjectModel(Absence)
    private readonly absenceModel: typeof Absence,
    private readonly mailService: MailService,
    private readonly auditService: AuditService,
  ) {}

  async create(
    userId: string,
    name: string,
    opts: { departments?: string[]; invites?: string[] } = {},
  ): Promise<Workspace> {
    // Welcome-письмо шлём только при создании первой компании пользователя.
    const priorOwned = await this.memberModel.count({
      where: { user_id: userId, role: WorkspaceRole.OWNER },
    });
    const workspace = await this.workspaceModel.create({
      name,
      owner_id: userId,
    });
    await this.memberModel.create({
      workspace_id: workspace.id,
      user_id: userId,
      role: WorkspaceRole.OWNER,
    });
    // Мастер создания компании: отделы и bulk-приглашения.
    for (const depName of opts.departments ?? []) {
      const trimmed = depName.trim();
      if (!trimmed) continue;
      await this.departmentModel.findOrCreate({
        where: { workspace_id: workspace.id, name: trimmed },
        defaults: { workspace_id: workspace.id, name: trimmed },
      });
    }
    // Созданная компания сразу становится активной в переключателе.
    await this.userModel.update(
      { active_workspace_id: workspace.id },
      { where: { id: userId } },
    );
    if (opts.invites?.length) {
      await this.bulkInvite(userId, opts.invites, WorkspaceRole.MEMBER);
    }
    if (priorOwned === 0) {
      const user = await this.userModel.findByPk(userId);
      if (user) {
        this.mailService
          .sendWelcome(user.email, user.name, workspace.name)
          .catch(() => undefined);
      }
    }
    return workspace;
  }

  /**
   * Текущий workspace пользователя: выбранный в переключателе
   * (users.active_workspace_id), иначе — принятая чужая команда, иначе своя;
   * при полном отсутствии создаётся автоматически.
   */
  async getCurrent(userId: string): Promise<Workspace> {
    const memberships = await this.memberModel.findAll({
      where: { user_id: userId },
      order: [['created_at', 'ASC']],
    });
    const user = await this.userModel.findByPk(userId);

    const chosen =
      (user?.active_workspace_id &&
        memberships.find((m) => m.workspace_id === user.active_workspace_id)) ||
      memberships.find((m) => m.role !== WorkspaceRole.OWNER) ||
      memberships[0];
    if (chosen) {
      const ws = await this.workspaceModel.findByPk(chosen.workspace_id);
      if (ws) return ws;
    }
    return this.create(userId, `Команда ${user?.name ?? ''}`.trim());
  }

  /** Компании пользователя для переключателя в сайдбаре. */
  async listMine(userId: string): Promise<WorkspaceListItem[]> {
    const memberships = await this.memberModel.findAll({
      where: { user_id: userId },
      order: [['created_at', 'ASC']],
    });
    if (!memberships.length) {
      await this.getCurrent(userId); // авто-создание первой компании
      return this.listMine(userId);
    }
    const current = await this.getCurrent(userId);
    const workspaces = await this.workspaceModel.findAll({
      where: { id: { [Op.in]: memberships.map((m) => m.workspace_id) } },
    });
    return memberships
      .map((m) => {
        const ws = workspaces.find((w) => w.id === m.workspace_id);
        if (!ws) return null;
        return {
          id: ws.id,
          name: ws.name,
          brand_color: ws.brand_color,
          logo_url: ws.logo_url,
          role: m.role,
          active: ws.id === current.id,
        };
      })
      .filter(Boolean) as WorkspaceListItem[];
  }

  /** Переключить активную компанию (только среди своих членств). */
  async switchTo(userId: string, workspaceId: string): Promise<Workspace> {
    const member = await this.memberModel.findOne({
      where: { workspace_id: workspaceId, user_id: userId },
    });
    if (!member) {
      throw new ForbiddenException('Вы не состоите в этой компании');
    }
    await this.userModel.update(
      { active_workspace_id: workspaceId },
      { where: { id: userId } },
    );
    const ws = await this.workspaceModel.findByPk(workspaceId);
    if (!ws) throw new NotFoundException('Компания не найдена');
    return ws;
  }

  /** Настройки компании: название, валюта, цвет, логотип, нормы (admin+). */
  async updateWorkspace(
    userId: string,
    dto: UpdateWorkspaceDto,
  ): Promise<Workspace> {
    const ctx = await this.getContext(userId);
    if (!ctx.isAdmin) {
      throw new ForbiddenException('Настройки компании доступны админу');
    }
    const ws = ctx.workspace;
    if (dto.name !== undefined) ws.name = dto.name;
    if (dto.currency !== undefined) ws.currency = dto.currency;
    if (dto.brand_color !== undefined) ws.brand_color = dto.brand_color;
    if (dto.logo_url !== undefined) ws.logo_url = dto.logo_url;
    if (dto.day_norm_hours !== undefined) ws.day_norm_hours = dto.day_norm_hours;
    if (dto.rounding_minutes !== undefined) {
      ws.rounding_minutes = dto.rounding_minutes;
    }
    await ws.save();
    this.auditService.log(ws.id, userId, 'изменил(а) настройки компании', {
      type: 'workspace',
      id: ws.id,
    });
    return ws;
  }

  // --- Отделы ---

  async listDepartments(userId: string): Promise<Department[]> {
    const ctx = await this.getContext(userId);
    return this.departmentModel.findAll({
      where: { workspace_id: ctx.workspace.id },
      order: [['created_at', 'ASC']],
    });
  }

  async createDepartment(userId: string, name: string): Promise<Department> {
    const ctx = await this.getContext(userId);
    if (!ctx.isAdmin) {
      throw new ForbiddenException('Отделы создаёт админ');
    }
    const [dep] = await this.departmentModel.findOrCreate({
      where: { workspace_id: ctx.workspace.id, name },
      defaults: { workspace_id: ctx.workspace.id, name },
    });
    return dep;
  }

  async removeDepartment(userId: string, id: string): Promise<void> {
    const ctx = await this.getContext(userId);
    if (!ctx.isAdmin) {
      throw new ForbiddenException('Отделы удаляет админ');
    }
    await this.memberModel.update(
      { department_id: null },
      { where: { workspace_id: ctx.workspace.id, department_id: id } },
    );
    await this.departmentModel.destroy({
      where: { id, workspace_id: ctx.workspace.id },
    });
  }

  // --- Профиль участника: оплата, отдел, отсутствия ---

  /** Изменение отдела и оплаты сотрудника (admin+). */
  async updateMember(
    adminId: string,
    targetUserId: string,
    dto: UpdateMemberDto,
  ): Promise<WorkspaceMember> {
    const ctx = await this.getContext(adminId);
    if (!ctx.isAdmin) {
      throw new ForbiddenException('Профиль сотрудника меняет админ');
    }
    const member = await this.memberModel.findOne({
      where: { workspace_id: ctx.workspace.id, user_id: targetUserId },
    });
    if (!member) throw new NotFoundException('Участник не найден');

    if (dto.department_id !== undefined) {
      if (dto.department_id) {
        const dep = await this.departmentModel.findOne({
          where: { id: dto.department_id, workspace_id: ctx.workspace.id },
        });
        if (!dep) throw new NotFoundException('Отдел не найден');
      }
      member.department_id = dto.department_id ?? null;
    }
    if (dto.pay_kind !== undefined) member.pay_kind = dto.pay_kind;
    if (dto.pay_rate !== undefined) member.pay_rate = dto.pay_rate;
    await member.save();
    this.auditService.log(
      ctx.workspace.id,
      adminId,
      'изменил(а) профиль сотрудника (оплата/отдел)',
      { type: 'member', id: member.id },
    );
    return member;
  }

  /** Ставка сотрудника в час: оклад пересчитывается по норме (dayNorm×20). */
  static hourlyRateOf(member: WorkspaceMember, dayNormHours: number): number {
    if (!member.pay_rate) return 0;
    return member.pay_kind === PayKind.SALARY
      ? member.pay_rate / Math.max(1, dayNormHours * 20)
      : member.pay_rate;
  }

  async listAbsences(userId: string, targetUserId?: string): Promise<Absence[]> {
    const ctx = await this.getContext(userId);
    const where: Record<string, unknown> = { workspace_id: ctx.workspace.id };
    if (targetUserId) where.user_id = targetUserId;
    else if (!ctx.isAdmin) where.user_id = userId;
    return this.absenceModel.findAll({
      where,
      order: [['date_from', 'DESC']],
    });
  }

  async createAbsence(
    adminId: string,
    targetUserId: string,
    dateFrom: string,
    dateTo: string,
    kind: AbsenceKind,
  ): Promise<Absence> {
    const ctx = await this.getContext(adminId);
    if (!ctx.isAdmin) {
      throw new ForbiddenException('Отсутствия отмечает админ');
    }
    if (!ctx.memberIds.includes(targetUserId)) {
      throw new NotFoundException('Участник не найден');
    }
    if (dateTo < dateFrom) {
      throw new BadRequestException('Дата окончания раньше начала');
    }
    const absence = await this.absenceModel.create({
      workspace_id: ctx.workspace.id,
      user_id: targetUserId,
      date_from: dateFrom,
      date_to: dateTo,
      kind,
    });
    this.auditService.log(
      ctx.workspace.id,
      adminId,
      `отметил(а) ${kind === AbsenceKind.SICK ? 'больничный' : 'отпуск'} ${dateFrom}–${dateTo}`,
      { type: 'absence', id: absence.id },
    );
    return absence;
  }

  async removeAbsence(adminId: string, id: string): Promise<void> {
    const ctx = await this.getContext(adminId);
    if (!ctx.isAdmin) {
      throw new ForbiddenException('Отсутствия снимает админ');
    }
    await this.absenceModel.destroy({
      where: { id, workspace_id: ctx.workspace.id },
    });
  }

  /** Действующие сейчас отсутствия участников (для статуса в «Команде»). */
  private async currentAbsences(
    workspaceId: string,
  ): Promise<Map<string, Absence>> {
    const today = new Date().toISOString().slice(0, 10);
    const rows = await this.absenceModel.findAll({
      where: {
        workspace_id: workspaceId,
        date_from: { [Op.lte]: today },
        date_to: { [Op.gte]: today },
      },
    });
    const map = new Map<string, Absence>();
    for (const r of rows) map.set(r.user_id, r);
    return map;
  }

  /** Развёрнутый профиль сотрудника (Команда → клик по имени). */
  async memberSummary(userId: string, targetUserId: string) {
    const ctx = await this.getContext(userId);
    if (!ctx.isAdmin && targetUserId !== userId) {
      throw new ForbiddenException('Профиль сотрудника доступен админу');
    }
    const member = await this.memberModel.findOne({
      where: { workspace_id: ctx.workspace.id, user_id: targetUserId },
      include: [User],
    });
    if (!member) throw new NotFoundException('Участник не найден');

    const todayRange = dayRange();
    const weekStart = new Date(Date.now() - 6 * 86_400_000);
    weekStart.setUTCHours(0, 0, 0, 0);
    const now = Date.now();

    const [entries, openTasks, departments, absences] = await Promise.all([
      this.timeEntryModel.findAll({
        where: {
          user_id: targetUserId,
          started_at: { [Op.gte]: weekStart },
          ...(entryScope(ctx.workspace.id) as object),
        },
        attributes: ['started_at', 'ended_at', 'duration_seconds'],
        raw: true,
      }),
      Task.findAll({
        where: {
          [Op.or]: [
            { assignee_id: targetUserId },
            { assignee_id: { [Op.is]: null }, user_id: targetUserId },
          ],
          status: { [Op.ne]: 'done' },
        },
        attributes: ['id', 'title', 'due_date', 'priority'],
        order: [['created_at', 'DESC']],
        limit: 20,
      }),
      this.departmentModel.findAll({
        where: { workspace_id: ctx.workspace.id },
      }),
      this.listAbsences(userId, targetUserId),
    ]);

    let todaySec = 0;
    let weekSec = 0;
    for (const e of entries as unknown as Array<{
      started_at: Date;
      ended_at: Date | null;
      duration_seconds: number;
    }>) {
      const startedAt = new Date(e.started_at);
      const sec = e.ended_at
        ? e.duration_seconds
        : Math.max(0, Math.round((now - startedAt.getTime()) / 1000));
      weekSec += sec;
      if (startedAt >= todayRange.start && startedAt <= todayRange.end) {
        todaySec += sec;
      }
    }

    const today = new Date().toISOString().slice(0, 10);
    const active = absences.find(
      (a) => a.date_from <= today && a.date_to >= today,
    );

    return {
      user_id: targetUserId,
      name: member.user?.name ?? '',
      email: member.user?.email ?? '',
      avatar_url: member.user?.avatar_url ?? null,
      role: member.role,
      department_id: member.department_id,
      department_name:
        departments.find((d) => d.id === member.department_id)?.name ?? null,
      pay_kind: member.pay_kind,
      pay_rate: member.pay_rate,
      hourly_rate: WorkspacesService.hourlyRateOf(
        member,
        ctx.workspace.day_norm_hours,
      ),
      today_seconds: todaySec,
      week_seconds: weekSec,
      open_tasks: openTasks.map((t) => ({
        id: t.id,
        title: t.title,
        due_date: t.due_date,
        priority: t.priority,
      })),
      absence: active
        ? { kind: active.kind, date_from: active.date_from, date_to: active.date_to }
        : null,
      absences: absences.map((a) => ({
        id: a.id,
        kind: a.kind,
        date_from: a.date_from,
        date_to: a.date_to,
      })),
    };
  }

  /** Workspace по id (для публичных отчётов и писем). */
  getById(workspaceId: string): Promise<Workspace | null> {
    return this.workspaceModel.findByPk(workspaceId);
  }

  /** Участники workspace (для публичных отчётов и агрегатов). */
  getMembers(workspaceId: string): Promise<WorkspaceMember[]> {
    return this.memberModel.findAll({ where: { workspace_id: workspaceId } });
  }

  /** Роль и границы текущего пользователя (для RBAC в других модулях). */
  async getContext(userId: string): Promise<WorkspaceContext> {
    const workspace = await this.getCurrent(userId);
    const members = await this.memberModel.findAll({
      where: { workspace_id: workspace.id },
    });
    const mine = members.find((m) => m.user_id === userId);
    const role = mine?.role ?? WorkspaceRole.MEMBER;
    return {
      workspace,
      role,
      project_id: mine?.project_id ?? null,
      memberIds: members.map((m) => m.user_id),
      isAdmin: ADMIN_ROLES.includes(role),
    };
  }

  private async requireMembership(
    workspaceId: string,
    userId: string,
  ): Promise<WorkspaceMember> {
    const member = await this.memberModel.findOne({
      where: { workspace_id: workspaceId, user_id: userId },
    });
    if (!member) {
      throw new ForbiddenException('Not a member of this workspace');
    }
    return member;
  }

  private assertCanInvite(member: WorkspaceMember): void {
    if (!ADMIN_ROLES.includes(member.role)) {
      throw new ForbiddenException('Only admins can manage invites');
    }
  }

  /** Участники с live-статусом и агрегатами за сегодня/неделю. */
  async listMembers(userId: string): Promise<WorkspaceMemberViewDto[]> {
    const workspace = await this.getCurrent(userId);
    await this.requireMembership(workspace.id, userId);

    const members = await this.memberModel.findAll({
      where: { workspace_id: workspace.id },
      include: [User],
      order: [['created_at', 'ASC']],
    });
    const userIds = members.map((m) => m.user_id);

    const todayRange = dayRange();
    const weekStart = new Date(Date.now() - 6 * 24 * 60 * 60 * 1000);
    weekStart.setUTCHours(0, 0, 0, 0);
    const now = Date.now();

    const [weekEntries, activeEntries, dndRows, departments, absences] =
      await Promise.all([
      this.timeEntryModel.findAll({
        where: {
          user_id: { [Op.in]: userIds },
          started_at: { [Op.gte]: weekStart },
          ...(entryScope(workspace.id) as object),
        },
        attributes: ['user_id', 'started_at', 'ended_at', 'duration_seconds'],
        raw: true,
      }),
      this.timeEntryModel.findAll({
        where: {
          user_id: { [Op.in]: userIds },
          ended_at: { [Op.is]: null },
          ...(entryScope(workspace.id) as object),
        },
        include: [Task],
      }),
      UserSettings.findAll({
        where: {
          user_id: { [Op.in]: userIds },
          dnd_until: { [Op.gt]: new Date() },
        },
        attributes: ['user_id'],
        raw: true,
      }),
      this.departmentModel.findAll({ where: { workspace_id: workspace.id } }),
      this.currentAbsences(workspace.id),
    ]);
    const dndUsers = new Set(
      (dndRows as unknown as Array<{ user_id: string }>).map((r) => r.user_id),
    );

    const todaySec = new Map<string, number>();
    const weekSec = new Map<string, number>();
    for (const e of weekEntries as unknown as Array<{
      user_id: string;
      started_at: Date;
      ended_at: Date | null;
      duration_seconds: number;
    }>) {
      const startedAt = new Date(e.started_at);
      const seconds = e.ended_at
        ? e.duration_seconds
        : Math.max(0, Math.round((now - startedAt.getTime()) / 1000));
      weekSec.set(e.user_id, (weekSec.get(e.user_id) ?? 0) + seconds);
      if (
        startedAt >= todayRange.start &&
        startedAt <= todayRange.end
      ) {
        todaySec.set(e.user_id, (todaySec.get(e.user_id) ?? 0) + seconds);
      }
    }

    const activeByUser = new Map<string, TimeEntry>();
    for (const e of activeEntries) activeByUser.set(e.user_id, e);

    // Ставки видны только owner/admin (ТЗ: деньги под ролью).
    const viewer = members.find((m) => m.user_id === userId);
    const canSeeMoney = ADMIN_ROLES.includes(viewer?.role ?? WorkspaceRole.MEMBER);

    return members.map((m) => {
      const active = activeByUser.get(m.user_id);
      const absence = absences.get(m.user_id);
      return {
        user_id: m.user_id,
        name: m.user?.name ?? '',
        email: m.user?.email ?? '',
        avatar_url: m.user?.avatar_url ?? null,
        role: m.role,
        department_id: m.department_id,
        department_name:
          departments.find((d) => d.id === m.department_id)?.name ?? null,
        active_task_title: active
          ? active.task?.title || active.description || 'Без названия'
          : null,
        dnd: dndUsers.has(m.user_id),
        absence_kind: absence?.kind ?? null,
        absence_until: absence?.date_to ?? null,
        pay_kind: canSeeMoney ? m.pay_kind : null,
        pay_rate: canSeeMoney ? m.pay_rate : null,
        hourly_rate: canSeeMoney
          ? WorkspacesService.hourlyRateOf(m, workspace.day_norm_hours)
          : null,
        today_seconds: todaySec.get(m.user_id) ?? 0,
        week_seconds: weekSec.get(m.user_id) ?? 0,
      };
    });
  }

  /** Смена роли участника (только владелец; роль владельца не меняется). */
  async changeRole(
    ownerId: string,
    targetUserId: string,
    role: WorkspaceRole,
    projectId?: string | null,
  ): Promise<WorkspaceMember> {
    const ctx = await this.getContext(ownerId);
    if (ctx.role !== WorkspaceRole.OWNER) {
      throw new ForbiddenException('Роли меняет только владелец команды');
    }
    if (role === WorkspaceRole.OWNER) {
      throw new BadRequestException('Владелец назначается при создании команды');
    }
    const member = await this.memberModel.findOne({
      where: { workspace_id: ctx.workspace.id, user_id: targetUserId },
    });
    if (!member) {
      throw new NotFoundException('Участник не найден');
    }
    if (member.role === WorkspaceRole.OWNER) {
      throw new BadRequestException('Роль владельца изменить нельзя');
    }
    member.role = role;
    member.project_id =
      role === WorkspaceRole.PM || role === WorkspaceRole.CLIENT
        ? (projectId ?? member.project_id)
        : null;
    await member.save();
    this.auditService.log(
      ctx.workspace.id,
      ownerId,
      `изменил(а) роль участника → ${role}`,
      { type: 'member', id: member.id },
    );
    return member;
  }

  async createInvite(
    userId: string,
    dto: CreateInviteDto,
  ): Promise<WorkspaceInvite> {
    const workspace = await this.getCurrent(userId);
    const member = await this.requireMembership(workspace.id, userId);
    this.assertCanInvite(member);

    // Владельцем по приглашению стать нельзя; остальные роли допустимы.
    const role =
      dto.role && dto.role !== WorkspaceRole.OWNER
        ? dto.role
        : WorkspaceRole.MEMBER;

    const invite = await this.inviteModel.create({
      workspace_id: workspace.id,
      email: dto.email.toLowerCase(),
      role,
      token: randomBytes(24).toString('hex'),
      status: InviteStatus.PENDING,
    });

    this.auditService.log(
      workspace.id,
      userId,
      `пригласил(а) ${invite.email} — роль ${ROLE_LABELS[role] ?? role}`,
      { type: 'invite', id: invite.id },
    );

    // Письмо-приглашение (дизайн Emails.dc.html); ошибка почты не ломает инвайт.
    const inviter = await this.userModel.findByPk(userId);
    if (inviter) {
      this.mailService
        .sendInvite(
          invite.email,
          { name: inviter.name, email: inviter.email },
          workspace.name,
          ROLE_LABELS[role] ?? role,
          invite.token,
        )
        .catch(() => undefined);
    }

    return invite;
  }

  /** Массовые приглашения из мастера компании. */
  async bulkInvite(
    userId: string,
    emails: string[],
    role: WorkspaceRole = WorkspaceRole.MEMBER,
  ): Promise<{ invited: number }> {
    let invited = 0;
    for (const email of emails) {
      const trimmed = email.trim().toLowerCase();
      if (!trimmed || !trimmed.includes('@')) continue;
      try {
        await this.createInvite(userId, { email: trimmed, role });
        invited++;
      } catch {
        /* дубликат или ошибка почты не должны ломать мастер */
      }
    }
    return { invited };
  }

  async listInvites(userId: string): Promise<WorkspaceInvite[]> {
    const workspace = await this.getCurrent(userId);
    await this.requireMembership(workspace.id, userId);
    return this.inviteModel.findAll({
      where: { workspace_id: workspace.id, status: InviteStatus.PENDING },
      order: [['created_at', 'DESC']],
    });
  }

  async revokeInvite(userId: string, inviteId: string): Promise<void> {
    const workspace = await this.getCurrent(userId);
    const member = await this.requireMembership(workspace.id, userId);
    this.assertCanInvite(member);

    const invite = await this.inviteModel.findOne({
      where: { id: inviteId, workspace_id: workspace.id },
    });
    if (!invite) {
      throw new NotFoundException('Invite not found');
    }
    invite.status = InviteStatus.REVOKED;
    await invite.save();
    this.auditService.log(
      workspace.id,
      userId,
      `отозвал(а) приглашение ${invite.email}`,
      { type: 'invite', id: invite.id },
    );
  }

  /** Многоразовая ссылка-приглашение (роль member): создаётся один раз на workspace. */
  async getInviteLink(userId: string): Promise<{ token: string }> {
    const workspace = await this.getCurrent(userId);
    const member = await this.requireMembership(workspace.id, userId);
    this.assertCanInvite(member);

    const [link] = await this.inviteModel.findOrCreate({
      where: {
        workspace_id: workspace.id,
        email: '',
        status: InviteStatus.PENDING,
      },
      defaults: {
        workspace_id: workspace.id,
        email: '',
        role: WorkspaceRole.MEMBER,
        token: randomBytes(24).toString('hex'),
        status: InviteStatus.PENDING,
      },
    });
    return { token: link.token };
  }

  /** Принять приглашение по токену: текущий пользователь становится участником. */
  async acceptInvite(userId: string, token: string): Promise<Workspace> {
    const invite = await this.inviteModel.findOne({
      where: { token, status: InviteStatus.PENDING },
    });
    if (!invite) {
      throw new NotFoundException('Приглашение не найдено или отозвано');
    }
    const existing = await this.memberModel.findOne({
      where: { workspace_id: invite.workspace_id, user_id: userId },
    });
    if (existing) {
      throw new BadRequestException('Вы уже участник этой команды');
    }
    await this.memberModel.create({
      workspace_id: invite.workspace_id,
      user_id: userId,
      role:
        invite.role && invite.role !== WorkspaceRole.OWNER
          ? invite.role
          : WorkspaceRole.MEMBER,
    });
    // Именные приглашения одноразовые; ссылка-приглашение (email='') остаётся активной.
    if (invite.email) {
      invite.status = InviteStatus.ACCEPTED;
      await invite.save();
    }
    const workspace = await this.workspaceModel.findByPk(invite.workspace_id);
    if (!workspace) {
      throw new NotFoundException('Workspace not found');
    }
    // По инвайту пользователь попадает СРАЗУ в компанию пригласившего (ТЗ, онбординг).
    await this.userModel.update(
      { active_workspace_id: workspace.id },
      { where: { id: userId } },
    );
    return workspace;
  }
}
