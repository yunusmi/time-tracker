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
  ChangeRoleDto,
  CreateInviteDto,
  CreateWorkspaceDto,
  InviteLinkDto,
  WorkspaceMemberViewDto,
} from './dto/workspaces.dto';
import { Workspace } from './entities/workspace.entity';
import { WorkspaceInvite } from './entities/workspace-invite.entity';

@ApiTags('workspaces')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller()
export class WorkspacesController {
  constructor(private readonly workspacesService: WorkspacesService) {}

  @Post('workspaces')
  @ApiOperation({ summary: 'Create a workspace (creator becomes owner)' })
  @ApiResponse({ status: 201, type: Workspace })
  create(
    @CurrentUser('id') userId: string,
    @Body() dto: CreateWorkspaceDto,
  ): Promise<Workspace> {
    return this.workspacesService.create(userId, dto.name);
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
