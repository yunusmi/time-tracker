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

const VERIFY_TOKEN_TTL_MS = 24 * 60 * 60 * 1000; // 24 часа

@Injectable()
export class UsersService {
  constructor(
    @InjectModel(User)
    private readonly userModel: typeof User,
  ) {}

  /** Includes password_hash for credential checks. */
  findByEmail(email: string): Promise<User | null> {
    return this.userModel.scope('withPassword').findOne({ where: { email } });
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
    return this.userModel.create({ ...data });
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
    if (dto.email !== undefined && dto.email !== user.email) {
      const taken = await this.userModel.findOne({
        where: { email: dto.email, id: { [Op.ne]: userId } },
      });
      if (taken) {
        throw new ConflictException('Email already registered');
      }
      user.email = dto.email;
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
