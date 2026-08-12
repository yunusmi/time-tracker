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
    return settings.save();
  }
}
