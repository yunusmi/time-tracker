import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { randomBytes } from 'crypto';
import { Op } from 'sequelize';
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
import { CreateInviteDto, WorkspaceMemberViewDto } from './dto/workspaces.dto';

const ROLE_LABELS: Record<string, string> = {
  owner: 'Владелец',
  admin: 'Админ',
  member: 'Участник',
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
    private readonly mailService: MailService,
    private readonly auditService: AuditService,
  ) {}

  async create(userId: string, name: string): Promise<Workspace> {
    const workspace = await this.workspaceModel.create({
      name,
      owner_id: userId,
    });
    await this.memberModel.create({
      workspace_id: workspace.id,
      user_id: userId,
      role: WorkspaceRole.OWNER,
    });
    return workspace;
  }

  /**
   * Текущий workspace пользователя; создаётся автоматически при первом
   * обращении. Если пользователь принят в чужую команду — она приоритетнее
   * личного авто-созданного workspace.
   */
  async getCurrent(userId: string): Promise<Workspace> {
    const memberships = await this.memberModel.findAll({
      where: { user_id: userId },
      order: [['created_at', 'ASC']],
    });
    const preferred =
      memberships.find((m) => m.role !== WorkspaceRole.OWNER) ??
      memberships[0];
    if (preferred) {
      const ws = await this.workspaceModel.findByPk(preferred.workspace_id);
      if (ws) return ws;
    }
    const user = await this.userModel.findByPk(userId);
    return this.create(userId, `Команда ${user?.name ?? ''}`.trim());
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

    const [weekEntries, activeEntries, dndRows] = await Promise.all([
      this.timeEntryModel.findAll({
        where: {
          user_id: { [Op.in]: userIds },
          started_at: { [Op.gte]: weekStart },
        },
        attributes: ['user_id', 'started_at', 'ended_at', 'duration_seconds'],
        raw: true,
      }),
      this.timeEntryModel.findAll({
        where: {
          user_id: { [Op.in]: userIds },
          ended_at: { [Op.is]: null },
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

    return members.map((m) => {
      const active = activeByUser.get(m.user_id);
      return {
        user_id: m.user_id,
        name: m.user?.name ?? '',
        email: m.user?.email ?? '',
        role: m.role,
        active_task_title: active
          ? active.task?.title || active.description || 'Без названия'
          : null,
        dnd: dndUsers.has(m.user_id),
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

    const role =
      dto.role === WorkspaceRole.ADMIN
        ? WorkspaceRole.ADMIN
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
        invite.role === WorkspaceRole.ADMIN
          ? WorkspaceRole.ADMIN
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
    return workspace;
  }
}
