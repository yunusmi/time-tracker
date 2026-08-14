import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/sequelize';
import { Op } from 'sequelize';
import {
  AppNotification,
  NotificationDot,
  NotificationKind,
} from './notification.entity';
import { PushSubscription } from './push-subscription.entity';
import { UserSettings } from '../users/entities/user-settings.entity';

/** События матрицы уведомлений (Настройки → Уведомления). */
export type NotificationEvent =
  | 'task_assigned'
  | 'admin_edits'
  | 'timesheet_status'
  | 'standup_reminder'
  | 'weekly_digest';

export type NotificationChannel = 'email' | 'push' | 'app';

/** Дефолты матрицы: email и «в кабинете» включены, пуши — по разрешению. */
const CHANNEL_DEFAULTS: Record<NotificationChannel, boolean> = {
  email: true,
  push: false,
  app: true,
};

export interface NotifyOptions {
  kind?: NotificationKind;
  /** Экран для кнопки действия (сегмент /dashboard/<screen>; '' = трекер). */
  action?: string | null;
  /** Событие матрицы; если задано — каналы фильтруются по префам. */
  event?: NotificationEvent;
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);
  // Модуль web-push подключается лениво: без VAPID-ключей пуши выключены.
  private webpush: typeof import('web-push') | null = null;
  private readonly vapidPublicKey: string;

  constructor(
    @InjectModel(AppNotification)
    private readonly notificationModel: typeof AppNotification,
    @InjectModel(PushSubscription)
    private readonly pushModel: typeof PushSubscription,
    @InjectModel(UserSettings)
    private readonly settingsModel: typeof UserSettings,
    config: ConfigService,
  ) {
    this.vapidPublicKey = config.get<string>('vapid.publicKey') ?? '';
    const privateKey = config.get<string>('vapid.privateKey') ?? '';
    if (this.vapidPublicKey && privateKey) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        this.webpush = require('web-push');
        this.webpush!.setVapidDetails(
          config.get<string>('vapid.subject') ?? 'mailto:no-reply@chronos.local',
          this.vapidPublicKey,
          privateKey,
        );
      } catch (err) {
        this.logger.warn(`web-push недоступен: ${err}`);
        this.webpush = null;
      }
    }
  }

  getVapidPublicKey(): { public_key: string; enabled: boolean } {
    return {
      public_key: this.vapidPublicKey,
      enabled: !!(this.webpush && this.vapidPublicKey),
    };
  }

  /** Включён ли канал для события у пользователя (матрица в user_settings). */
  async channelEnabled(
    userId: string,
    event: NotificationEvent,
    channel: NotificationChannel,
  ): Promise<boolean> {
    try {
      const settings = await this.settingsModel.findOne({
        where: { user_id: userId },
        attributes: ['notification_prefs'],
        raw: true,
      });
      const prefs =
        (settings as unknown as {
          notification_prefs?: Record<
            string,
            Partial<Record<NotificationChannel, boolean>>
          >;
        })?.notification_prefs ?? {};
      const value = prefs[event]?.[channel];
      return value ?? CHANNEL_DEFAULTS[channel];
    } catch {
      return CHANNEL_DEFAULTS[channel];
    }
  }

  /**
   * Создаёт in-app уведомление и (если разрешено) шлёт Web Push.
   * Ошибки не прерывают основную операцию.
   */
  notify(
    userId: string,
    text: string,
    dot: NotificationDot = 'accent',
    opts: NotifyOptions = {},
  ): void {
    void (async () => {
      try {
        const channels: string[] = [];
        const appOn = opts.event
          ? await this.channelEnabled(userId, opts.event, 'app')
          : true;
        const pushOn =
          !!this.webpush &&
          (opts.event
            ? await this.channelEnabled(userId, opts.event, 'push')
            : false);
        if (appOn) channels.push('app');
        if (pushOn) channels.push('push');
        if (opts.event) {
          if (await this.channelEnabled(userId, opts.event, 'email')) {
            channels.push('email');
          }
        }
        if (appOn) {
          await this.notificationModel.create({
            user_id: userId,
            text,
            dot,
            kind: opts.kind ?? 'system',
            action_screen: opts.action ?? null,
            channels,
          });
        }
        if (pushOn) await this.sendPush(userId, text);
      } catch (err) {
        this.logger.warn(`notification write failed: ${err}`);
      }
    })();
  }

  /** Web Push всем подпискам пользователя; мёртвые подписки удаляются. */
  private async sendPush(userId: string, text: string): Promise<void> {
    if (!this.webpush) return;
    const subs = await this.pushModel.findAll({ where: { user_id: userId } });
    await Promise.all(
      subs.map(async (sub) => {
        try {
          await this.webpush!.sendNotification(
            { endpoint: sub.endpoint, keys: sub.keys },
            JSON.stringify({ title: 'Хронос', body: text }),
          );
        } catch (err: unknown) {
          const status = (err as { statusCode?: number })?.statusCode;
          if (status === 404 || status === 410) await sub.destroy();
        }
      }),
    );
  }

  async subscribePush(
    userId: string,
    endpoint: string,
    keys: { p256dh: string; auth: string },
  ): Promise<void> {
    await this.pushModel.destroy({ where: { endpoint } });
    await this.pushModel.create({ user_id: userId, endpoint, keys });
  }

  async unsubscribePush(userId: string, endpoint: string): Promise<void> {
    await this.pushModel.destroy({ where: { user_id: userId, endpoint } });
  }

  /** Список с фильтрами и курсорной пагинацией (limit 50). */
  list(
    userId: string,
    opts: {
      limit?: number;
      filter?: 'all' | 'unread' | 'timesheets' | 'tasks';
      before?: string;
    } = {},
  ): Promise<AppNotification[]> {
    const where: Record<string, unknown> = { user_id: userId };
    if (opts.filter === 'unread') where.read = false;
    if (opts.filter === 'timesheets') where.kind = 'timesheet';
    if (opts.filter === 'tasks') where.kind = 'task';
    if (opts.before) where.created_at = { [Op.lt]: new Date(opts.before) };
    return this.notificationModel.findAll({
      where,
      order: [['created_at', 'DESC']],
      limit: Math.min(Math.max(opts.limit ?? 20, 1), 50),
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

  async markRead(userId: string, id: string): Promise<void> {
    await this.notificationModel.update(
      { read: true },
      { where: { user_id: userId, id } },
    );
  }

  async removeOne(userId: string, id: string): Promise<void> {
    await this.notificationModel.destroy({ where: { user_id: userId, id } });
  }

  /** «Очистить» в центре уведомлений. */
  async clear(userId: string): Promise<void> {
    await this.notificationModel.destroy({ where: { user_id: userId } });
  }
}
