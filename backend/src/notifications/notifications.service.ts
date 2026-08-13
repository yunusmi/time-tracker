import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { AppNotification, NotificationDot } from './notification.entity';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    @InjectModel(AppNotification)
    private readonly notificationModel: typeof AppNotification,
  ) {}

  /** Создаёт уведомление; ошибки не прерывают основную операцию. */
  notify(userId: string, text: string, dot: NotificationDot = 'accent'): void {
    this.notificationModel
      .create({ user_id: userId, text, dot })
      .catch((err) => this.logger.warn(`notification write failed: ${err}`));
  }

  list(userId: string, limit = 20): Promise<AppNotification[]> {
    return this.notificationModel.findAll({
      where: { user_id: userId },
      order: [['created_at', 'DESC']],
      limit: Math.min(Math.max(limit, 1), 50),
    });
  }

  async unreadCount(userId: string): Promise<number> {
    return this.notificationModel.count({
      where: { user_id: userId, read: false },
    });
  }

  async markAllRead(userId: string): Promise<void> {
    await this.notificationModel.update(
      { read: true },
      { where: { user_id: userId, read: false } },
    );
  }

  /** «Очистить» в центре уведомлений. */
  async clear(userId: string): Promise<void> {
    await this.notificationModel.destroy({ where: { user_id: userId } });
  }
}
