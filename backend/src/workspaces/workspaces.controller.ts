import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { WorkspacesService } from './workspaces.service';
import {
  BulkInviteDto,
  ChangeRoleDto,
  CreateAbsenceDto,
  CreateDepartmentDto,
  CreateInviteDto,
  CreateWorkspaceDto,
  InviteLinkDto,
  SwitchWorkspaceDto,
  UpdateMemberDto,
  UpdateWorkspaceDto,
  WorkspaceMemberViewDto,
} from './dto/workspaces.dto';
import { Workspace } from './entities/workspace.entity';
import { WorkspaceInvite } from './entities/workspace-invite.entity';
import { AbsenceKind } from './entities/absence.entity';

@ApiTags('workspaces')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller()
export class WorkspacesController {
  constructor(private readonly workspacesService: WorkspacesService) {}

  @Post('workspaces')
  @ApiOperation({
    summary:
      'Создать компанию (мастер: название → отделы → bulk-приглашения); создатель = владелец',
  })
  @ApiResponse({ status: 201, type: Workspace })
  create(
    @CurrentUser('id') userId: string,
    @Body() dto: CreateWorkspaceDto,
  ): Promise<Workspace> {
    return this.workspacesService.create(userId, dto.name, {
      departments: dto.departments,
      invites: dto.invites,
    });
  }

  @Get('workspaces')
  @ApiOperation({ summary: 'Мои компании для переключателя в сайдбаре' })
  listMine(@CurrentUser('id') userId: string) {
    return this.workspacesService.listMine(userId);
  }

  @Post('workspaces/switch')
  @HttpCode(200)
  @ApiOperation({ summary: 'Переключить активную компанию' })
  switchTo(
    @CurrentUser('id') userId: string,
    @Body() dto: SwitchWorkspaceDto,
  ): Promise<Workspace> {
    return this.workspacesService.switchTo(userId, dto.workspace_id);
  }

  @Patch('workspaces/current')
  @ApiOperation({
    summary: 'Настройки компании: название, валюта, цвет, логотип (admin+)',
  })
  updateWorkspace(
    @CurrentUser('id') userId: string,
    @Body() dto: UpdateWorkspaceDto,
  ): Promise<Workspace> {
    return this.workspacesService.updateWorkspace(userId, dto);
  }

  // --- Отделы ---

  @Get('workspaces/current/departments')
  @ApiOperation({ summary: 'Отделы компании' })
  listDepartments(@CurrentUser('id') userId: string) {
    return this.workspacesService.listDepartments(userId);
  }

  @Post('workspaces/current/departments')
  @ApiOperation({ summary: 'Создать отдел (admin+)' })
  createDepartment(
    @CurrentUser('id') userId: string,
    @Body() dto: CreateDepartmentDto,
  ) {
    return this.workspacesService.createDepartment(userId, dto.name);
  }

  @Delete('workspaces/current/departments/:id')
  @HttpCode(204)
  @ApiOperation({ summary: 'Удалить отдел (admin+)' })
  removeDepartment(
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    return this.workspacesService.removeDepartment(userId, id);
  }

  // --- Профиль сотрудника: оплата, отдел, отсутствия ---

  @Get('members/:id/summary')
  @ApiOperation({
    summary: 'Профиль сотрудника: роль, отдел, часы, задачи, ставка, отпуск',
  })
  memberSummary(
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) targetUserId: string,
  ) {
    return this.workspacesService.memberSummary(userId, targetUserId);
  }

  @Patch('workspaces/current/members/:userId')
  @ApiOperation({ summary: 'Отдел и оплата сотрудника (admin+)' })
  updateMember(
    @CurrentUser('id') userId: string,
    @Param('userId', ParseUUIDPipe) targetUserId: string,
    @Body() dto: UpdateMemberDto,
  ) {
    return this.workspacesService.updateMember(userId, targetUserId, dto);
  }

  @Get('absences')
  @ApiOperation({ summary: 'Отсутствия (отпуск/больничный)' })
  listAbsences(
    @CurrentUser('id') userId: string,
    @Query('user_id') targetUserId?: string,
  ) {
    return this.workspacesService.listAbsences(userId, targetUserId);
  }

  @Post('absences')
  @ApiOperation({ summary: 'Отметить отпуск/больничный сотруднику (admin+)' })
  createAbsence(
    @CurrentUser('id') userId: string,
    @Body() dto: CreateAbsenceDto,
  ) {
    return this.workspacesService.createAbsence(
      userId,
      dto.user_id,
      dto.date_from,
      dto.date_to,
      dto.kind ?? AbsenceKind.VACATION,
    );
  }

  @Delete('absences/:id')
  @HttpCode(204)
  @ApiOperation({ summary: 'Снять отсутствие (admin+)' })
  removeAbsence(
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    return this.workspacesService.removeAbsence(userId, id);
  }

  @Get('workspaces/current')
  @ApiOperation({
    summary: 'Get the current workspace (auto-created on first call)',
  })
  @ApiResponse({ status: 200, type: Workspace })
  getCurrent(@CurrentUser('id') userId: string): Promise<Workspace> {
    return this.workspacesService.getCurrent(userId);
  }

  @Get('workspaces/current/me')
  @ApiOperation({
    summary: 'Current user role and scope in the workspace',
  })
  async getMyContext(@CurrentUser('id') userId: string) {
    const ctx = await this.workspacesService.getContext(userId);
    return {
      workspace_id: ctx.workspace.id,
      workspace_name: ctx.workspace.name,
      role: ctx.role,
      project_id: ctx.project_id,
      currency: ctx.workspace.currency,
      brand_color: ctx.workspace.brand_color,
      logo_url: ctx.workspace.logo_url,
      day_norm_hours: ctx.workspace.day_norm_hours,
      rounding_minutes: ctx.workspace.rounding_minutes,
    };
  }

  @Get('workspaces/current/members')
  @ApiOperation({
    summary: 'List members with live status and today/week totals',
  })
  @ApiResponse({ status: 200, type: [WorkspaceMemberViewDto] })
  listMembers(
    @CurrentUser('id') userId: string,
  ): Promise<WorkspaceMemberViewDto[]> {
    return this.workspacesService.listMembers(userId);
  }

  @Patch('workspaces/current/members/:userId/role')
  @ApiOperation({ summary: 'Сменить роль участника (только владелец)' })
  changeRole(
    @CurrentUser('id') userId: string,
    @Param('userId', ParseUUIDPipe) targetUserId: string,
    @Body() dto: ChangeRoleDto,
  ) {
    return this.workspacesService.changeRole(
      userId,
      targetUserId,
      dto.role,
      dto.project_id,
    );
  }

  @Get('workspaces/current/invites')
  @ApiOperation({ summary: 'List pending invites' })
  @ApiResponse({ status: 200, type: [WorkspaceInvite] })
  listInvites(@CurrentUser('id') userId: string): Promise<WorkspaceInvite[]> {
    return this.workspacesService.listInvites(userId);
  }

  @Post('workspaces/current/invites')
  @ApiOperation({ summary: 'Invite a colleague by email (admin+)' })
  @ApiResponse({ status: 201, type: WorkspaceInvite })
  createInvite(
    @CurrentUser('id') userId: string,
    @Body() dto: CreateInviteDto,
  ): Promise<WorkspaceInvite> {
    return this.workspacesService.createInvite(userId, dto);
  }

  @Post('workspaces/current/invites/bulk')
  @HttpCode(200)
  @ApiOperation({ summary: 'Массовые приглашения (мастер компании, admin+)' })
  bulkInvite(
    @CurrentUser('id') userId: string,
    @Body() dto: BulkInviteDto,
  ): Promise<{ invited: number }> {
    return this.workspacesService.bulkInvite(userId, dto.emails ?? [], dto.role);
  }

  @Delete('workspaces/current/invites/:id')
  @HttpCode(204)
  @ApiOperation({ summary: 'Revoke a pending invite (admin+)' })
  @ApiResponse({ status: 204 })
  revokeInvite(
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) inviteId: string,
  ): Promise<void> {
    return this.workspacesService.revokeInvite(userId, inviteId);
  }

  @Get('workspaces/current/invite-link')
  @ApiOperation({ summary: 'Get the reusable invite-link token (admin+)' })
  @ApiResponse({ status: 200, type: InviteLinkDto })
  getInviteLink(@CurrentUser('id') userId: string): Promise<InviteLinkDto> {
    return this.workspacesService.getInviteLink(userId);
  }

  @Post('invites/:token/accept')
  @ApiOperation({ summary: 'Accept an invite by token' })
  @ApiResponse({ status: 201, type: Workspace })
  acceptInvite(
    @CurrentUser('id') userId: string,
    @Param('token') token: string,
  ): Promise<Workspace> {
    return this.workspacesService.acceptInvite(userId, token);
  }
}
