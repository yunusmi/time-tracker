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
  WorkspaceMember,
  WorkspaceRole,
} from './entities/workspace-member.entity';
import {
  InviteStatus,
  WorkspaceInvite,
} from './entities/workspace-invite.entity';
import { User } from '../users/entities/user.entity';
import { Task } from '../tasks/entities/task.entity';
import { TimeEntry } from '../time-entries/entities/time-entry.entity';
import { TimeEntriesService } from '../time-entries/time-entries.service';
import { CreateInviteDto, WorkspaceMemberViewDto } from './dto/workspaces.dto';

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

  /** Текущий workspace пользователя; создаётся автоматически при первом обращении. */
  async getCurrent(userId: string): Promise<Workspace> {
    const membership = await this.memberModel.findOne({
      where: { user_id: userId },
      order: [['created_at', 'ASC']],
    });
    if (membership) {
      const ws = await this.workspaceModel.findByPk(membership.workspace_id);
      if (ws) return ws;
    }
    const user = await this.userModel.findByPk(userId);
    return this.create(userId, `Команда ${user?.name ?? ''}`.trim());
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
    if (member.role === WorkspaceRole.MEMBER) {
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

    const todayRange = TimeEntriesService.dayRange();
    const weekStart = new Date(Date.now() - 6 * 24 * 60 * 60 * 1000);
    weekStart.setUTCHours(0, 0, 0, 0);
    const now = Date.now();

    const [weekEntries, activeEntries] = await Promise.all([
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
    ]);

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
        today_seconds: todaySec.get(m.user_id) ?? 0,
        week_seconds: weekSec.get(m.user_id) ?? 0,
      };
    });
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

    return this.inviteModel.create({
      workspace_id: workspace.id,
      email: dto.email.toLowerCase(),
      role,
      token: randomBytes(24).toString('hex'),
      status: InviteStatus.PENDING,
    });
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
