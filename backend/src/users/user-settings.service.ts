import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { UserSettings } from './entities/user-settings.entity';
import { UpdateUserSettingsDto } from './dto/update-user-settings.dto';

@Injectable()
export class UserSettingsService {
  constructor(
    @InjectModel(UserSettings)
    private readonly userSettingsModel: typeof UserSettings,
  ) {}

  /** Возвращает настройки пользователя, создавая строку с дефолтами при первом обращении. */
  async getOrCreate(userId: string): Promise<UserSettings> {
    const [settings] = await this.userSettingsModel.findOrCreate({
      where: { user_id: userId },
      defaults: { user_id: userId },
    });
    return settings;
  }

  async update(
    userId: string,
    dto: UpdateUserSettingsDto,
  ): Promise<UserSettings> {
    const settings = await this.getOrCreate(userId);
    if (dto.daily_goal_hours !== undefined) {
      settings.daily_goal_hours = dto.daily_goal_hours;
    }
    if (dto.idle_threshold_minutes !== undefined) {
      settings.idle_threshold_minutes = dto.idle_threshold_minutes;
    }
    if (dto.notify_day_start !== undefined) {
      settings.notify_day_start = dto.notify_day_start;
    }
    if (dto.notify_goal_reached !== undefined) {
      settings.notify_goal_reached = dto.notify_goal_reached;
    }
    if (dto.theme !== undefined) {
      settings.theme = dto.theme;
    }
    if (dto.dnd_until !== undefined) {
      settings.dnd_until = dto.dnd_until ? new Date(dto.dnd_until) : null;
    }
    if (dto.auto_stop_evening !== undefined) {
      settings.auto_stop_evening = dto.auto_stop_evening;
    }
    if (dto.standup_greeting !== undefined) {
      settings.standup_greeting = dto.standup_greeting;
    }
    if (dto.standup_misc_line !== undefined) {
      settings.standup_misc_line = dto.standup_misc_line;
    }
    if (dto.standup_signature !== undefined) {
      settings.standup_signature = dto.standup_signature;
    }
    if (dto.standup_auto_send !== undefined) {
      settings.standup_auto_send = dto.standup_auto_send;
    }
    if (dto.monthly_hours_limit !== undefined) {
      settings.monthly_hours_limit = dto.monthly_hours_limit;
    }
    return settings.save();
  }
}
