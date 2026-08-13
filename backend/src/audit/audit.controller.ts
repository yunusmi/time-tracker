import {
  Controller,
  ForbiddenException,
  Get,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuditService } from './audit.service';
import { WorkspacesService } from '../workspaces/workspaces.service';

@ApiTags('audit')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('audit')
export class AuditController {
  constructor(
    private readonly auditService: AuditService,
    private readonly workspacesService: WorkspacesService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Аудит-лог действий команды (admin+)' })
  @ApiQuery({ name: 'limit', required: false, example: 20 })
  async list(
    @CurrentUser('id') userId: string,
    @Query('limit') limit?: string,
  ) {
    const ctx = await this.workspacesService.getContext(userId);
    if (!ctx.isAdmin) {
      throw new ForbiddenException('Аудит-лог доступен только админу');
    }
    const rows = await this.auditService.list(
      ctx.workspace.id,
      limit ? Number(limit) : undefined,
    );
    return rows.map((r) => ({
      id: r.id,
      user_id: r.user_id,
      user_name: r.user?.name ?? '',
      action: r.action,
      created_at: r.created_at,
    }));
  }
}
