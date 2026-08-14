import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { randomBytes } from 'crypto';
import * as bcrypt from 'bcryptjs';
import { Op } from 'sequelize';
import { User } from './entities/user.entity';
import { Task } from '../tasks/entities/task.entity';
import { TimeEntry } from '../time-entries/entities/time-entry.entity';
import { Project } from '../projects/entities/project.entity';

/** Единая нормализация почты: сравнение и хранение — в нижнем регистре. */
function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

const VERIFY_TOKEN_TTL_MS = 24 * 60 * 60 * 1000; // 24 часа
const RESET_TOKEN_TTL_MS = 60 * 60 * 1000; // 1 час
const MAGIC_TOKEN_TTL_MS = 15 * 60 * 1000; // 15 минут

@Injectable()
export class UsersService {
  constructor(
    @InjectModel(User)
    private readonly userModel: typeof User,
    @InjectModel(Task)
    private readonly taskModel: typeof Task,
    @InjectModel(TimeEntry)
    private readonly timeEntryModel: typeof TimeEntry,
    @InjectModel(Project)
    private readonly projectModel: typeof Project,
  ) {}

  /** Includes password_hash for credential checks. Email — регистронезависим. */
  findByEmail(email: string): Promise<User | null> {
    return this.userModel
      .scope('withPassword')
      .findOne({ where: { email: normalizeEmail(email) } });
  }

  async findById(id: string): Promise<User> {
    const user = await this.userModel.findByPk(id);
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return user;
  }

  findByIdOrNull(id: string): Promise<User | null> {
    return this.userModel.findByPk(id);
  }

  create(data: {
    email: string;
    name: string;
    password_hash: string;
  }): Promise<User> {
    // Почта хранится в нижнем регистре: логин, сброс и инвайты ищут по ней.
    return this.userModel.create({
      ...data,
      email: normalizeEmail(data.email),
    });
  }

  /** Обновление профиля; смена email сбрасывает верификацию почты. */
  async updateProfile(
    userId: string,
    dto: { name?: string; email?: string },
  ): Promise<User> {
    const user = await this.findById(userId);
    if (dto.name !== undefined) {
      user.name = dto.name;
    }
    const nextEmail =
      dto.email !== undefined ? normalizeEmail(dto.email) : undefined;
    if (nextEmail !== undefined && nextEmail !== user.email) {
      const taken = await this.userModel.findOne({
        where: { email: nextEmail, id: { [Op.ne]: userId } },
      });
      if (taken) {
        throw new ConflictException('Email already registered');
      }
      user.email = nextEmail;
      user.email_verified_at = null;
      user.verify_token = null;
      user.verify_token_expires = null;
    }
    return user.save();
  }

  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
  ): Promise<void> {
    const user = await this.userModel
      .scope('withPassword')
      .findByPk(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }
    const valid = await bcrypt.compare(currentPassword, user.password_hash);
    if (!valid) {
      throw new UnauthorizedException('Текущий пароль неверен');
    }
    user.password_hash = await bcrypt.hash(newPassword, 10);
    await user.save();
  }

  /** Пользователь со скрытыми полями (totp_secret) для 2FA-флоу. */
  async findWithSecrets(userId: string): Promise<User> {
    const user = await this.userModel.scope('withPassword').findByPk(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return user;
  }

  async setTotpSecret(
    userId: string,
    secret: string | null,
    enabled: boolean,
  ): Promise<void> {
    const user = await this.findWithSecrets(userId);
    user.totp_secret = secret;
    user.totp_enabled = enabled;
    await user.save();
  }

  /** Генерирует одноразовый токен верификации (TTL 24ч). */
  async issueVerifyToken(userId: string): Promise<{ user: User; token: string }> {
    const user = await this.findById(userId);
    if (user.email_verified_at) {
      throw new BadRequestException('Почта уже подтверждена');
    }
    const token = randomBytes(24).toString('hex');
    user.verify_token = token;
    user.verify_token_expires = new Date(Date.now() + VERIFY_TOKEN_TTL_MS);
    await user.save();
    return { user, token };
  }

  /** Токен сброса пароля (TTL 1ч); null — пользователя с такой почтой нет. */
  async issueResetToken(
    email: string,
  ): Promise<{ user: User; token: string } | null> {
    const user = await this.userModel
      .scope('withPassword')
      .findOne({ where: { email: normalizeEmail(email) } });
    if (!user) return null;
    const token = randomBytes(24).toString('hex');
    user.reset_token = token;
    user.reset_token_expires = new Date(Date.now() + RESET_TOKEN_TTL_MS);
    await user.save();
    return { user, token };
  }

  /** Устанавливает новый пароль по токену сброса. */
  async resetPassword(token: string, newPassword: string): Promise<User> {
    if (!token) throw new BadRequestException('Токен не указан');
    const user = await this.userModel
      .scope('withPassword')
      .findOne({ where: { reset_token: token } });
    if (!user) {
      throw new NotFoundException('Ссылка недействительна или уже использована');
    }
    if (
      !user.reset_token_expires ||
      user.reset_token_expires.getTime() < Date.now()
    ) {
      throw new BadRequestException('Срок действия ссылки истёк — запросите новую');
    }
    user.password_hash = await bcrypt.hash(newPassword, 10);
    user.reset_token = null;
    user.reset_token_expires = null;
    await user.save();
    return user;
  }

  /** Токен входа по ссылке (magic link, TTL 15 мин). */
  async issueMagicToken(
    email: string,
  ): Promise<{ user: User; token: string } | null> {
    const user = await this.userModel
      .scope('withPassword')
      .findOne({ where: { email: normalizeEmail(email) } });
    if (!user) return null;
    const token = randomBytes(24).toString('hex');
    user.magic_token = token;
    user.magic_token_expires = new Date(Date.now() + MAGIC_TOKEN_TTL_MS);
    await user.save();
    return { user, token };
  }

  /** Гасит magic-токен и возвращает пользователя (одноразово). */
  async consumeMagicToken(token: string): Promise<User> {
    if (!token) throw new BadRequestException('Токен не указан');
    const user = await this.userModel
      .scope('withPassword')
      .findOne({ where: { magic_token: token } });
    if (!user) {
      throw new NotFoundException('Ссылка недействительна или уже использована');
    }
    if (
      !user.magic_token_expires ||
      user.magic_token_expires.getTime() < Date.now()
    ) {
      throw new BadRequestException('Срок действия ссылки истёк — запросите новую');
    }
    user.magic_token = null;
    user.magic_token_expires = null;
    // Вход по ссылке из письма подтверждает владение почтой.
    if (!user.email_verified_at) user.email_verified_at = new Date();
    await user.save();
    return user;
  }

  /** Аватар пользователя (data-URL 128px) или null. */
  async setAvatar(userId: string, avatarUrl: string | null): Promise<User> {
    const user = await this.findById(userId);
    user.avatar_url = avatarUrl;
    return user.save();
  }

  /** Полное удаление аккаунта (GDPR). */
  async removeAccount(userId: string): Promise<void> {
    const user = await this.findById(userId);
    await Promise.all([
      this.timeEntryModel.destroy({ where: { user_id: userId } }),
      this.taskModel.destroy({ where: { user_id: userId } }),
      this.projectModel.destroy({ where: { user_id: userId } }),
    ]);
    await user.destroy();
  }

  /** Экспорт всех данных пользователя одним JSON (GDPR). */
  async exportData(userId: string): Promise<Record<string, unknown>> {
    const user = await this.findById(userId);
    const [tasks, entries, projects] = await Promise.all([
      this.taskModel.findAll({ where: { user_id: userId }, raw: true }),
      this.timeEntryModel.findAll({ where: { user_id: userId }, raw: true }),
      this.projectModel.findAll({ where: { user_id: userId }, raw: true }),
    ]);
    return {
      exported_at: new Date().toISOString(),
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        created_at: user.created_at,
        email_verified_at: user.email_verified_at,
      },
      projects,
      tasks,
      time_entries: entries,
    };
  }

  /** Подтверждает почту по токену (одноразовый, с TTL). */
  async verifyEmail(token: string): Promise<User> {
    if (!token) {
      throw new BadRequestException('Токен не указан');
    }
    const user = await this.userModel
      .scope('withPassword')
      .findOne({ where: { verify_token: token } });
    if (!user) {
      throw new NotFoundException('Ссылка недействительна или уже использована');
    }
    if (
      !user.verify_token_expires ||
      user.verify_token_expires.getTime() < Date.now()
    ) {
      throw new BadRequestException('Срок действия ссылки истёк — запросите новую');
    }
    user.email_verified_at = new Date();
    user.verify_token = null;
    user.verify_token_expires = null;
    await user.save();
    return user;
  }
}
