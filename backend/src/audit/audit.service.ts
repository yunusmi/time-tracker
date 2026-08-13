import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { AuditLog } from './audit-log.entity';
import { User } from '../users/entities/user.entity';

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(
    @InjectModel(AuditLog)
    private readonly auditModel: typeof AuditLog,
  ) {}

  /** Пишет событие аудита; ошибки не прерывают основную операцию. */
  log(
    workspaceId: string,
    userId: string,
    action: string,
    entity?: { type: string; id?: string; meta?: Record<string, unknown> },
  ): void {
    this.auditModel
      .create({
        workspace_id: workspaceId,
        user_id: userId,
        action,
        entity_type: entity?.type ?? null,
        entity_id: entity?.id ?? null,
        meta: entity?.meta ?? null,
      })
      .catch((err) => this.logger.warn(`audit write failed: ${err}`));
  }

  /** Последние события workspace (для карточки в «Команде», admin+). */
  list(workspaceId: string, limit = 20): Promise<AuditLog[]> {
    return this.auditModel.findAll({
      where: { workspace_id: workspaceId },
      include: [{ model: User, attributes: ['id', 'name'] }],
      order: [['created_at', 'DESC']],
      limit: Math.min(Math.max(limit, 1), 100),
    });
  }
}
