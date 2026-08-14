import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { generateSecret, generateURI, verifyTotp } from './totp';
import { UsersService } from '../users/users.service';
import { User } from '../users/entities/user.entity';
import { MailService } from '../mail/mail.service';
import { SessionsService, deviceFromUserAgent } from './sessions.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { AuthResponseDto } from './dto/auth-response.dto';
import { JwtPayload } from './strategies/jwt.strategy';

/** Метаданные запроса для сессий, капчи и писем. */
export interface RequestMeta {
  userAgent?: string;
  ip?: string;
}

/** Счётчик неудачных попыток входа: капча после 2 неудач (ТЗ Auth 2.0). */
const FAILED_ATTEMPTS = new Map<string, { count: number; at: number }>();
const FAIL_WINDOW_MS = 15 * 60 * 1000;
const CAPTCHA_AFTER = 2;

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly sessionsService: SessionsService,
    private readonly mailService: MailService,
  ) {}

  private static failKey(email: string): string {
    return email.trim().toLowerCase();
  }

  /** Сколько неудачных попыток входа накоплено для почты. */
  static failedAttempts(email: string): number {
    const rec = FAILED_ATTEMPTS.get(AuthService.failKey(email));
    if (!rec) return 0;
    if (Date.now() - rec.at > FAIL_WINDOW_MS) {
      FAILED_ATTEMPTS.delete(AuthService.failKey(email));
      return 0;
    }
    return rec.count;
  }

  /** Нужна ли капча на форме входа для этой почты. */
  captchaRequired(email: string): boolean {
    return AuthService.failedAttempts(email) >= CAPTCHA_AFTER;
  }

  private registerFailure(email: string): void {
    const key = AuthService.failKey(email);
    const prev = AuthService.failedAttempts(email);
    FAILED_ATTEMPTS.set(key, { count: prev + 1, at: Date.now() });
  }

  private clearFailures(email: string): void {
    FAILED_ATTEMPTS.delete(AuthService.failKey(email));
  }

  async register(
    dto: RegisterDto,
    meta: RequestMeta = {},
  ): Promise<AuthResponseDto> {
    const existing = await this.usersService.findByEmail(dto.email);
    if (existing) {
      throw new ConflictException('Email already registered');
    }
    const password_hash = await bcrypt.hash(dto.password, 10);
    const user = await this.usersService.create({
      email: dto.email,
      name: dto.name,
      password_hash,
    });
    // Письмо верификации сразу после регистрации (ошибка почты не ломает флоу).
    this.usersService
      .issueVerifyToken(user.id)
      .then(({ token }) =>
        this.mailService.sendVerification(user.email, user.name, token),
      )
      .catch(() => undefined);
    return this.buildResponse(user, meta);
  }

  async login(dto: LoginDto, meta: RequestMeta = {}): Promise<AuthResponseDto> {
    // Капча обязательна после 2 неудачных попыток.
    if (this.captchaRequired(dto.email) && !dto.captcha_answer) {
      throw new UnauthorizedException('captcha_required');
    }
    const user = await this.usersService.findByEmail(dto.email);
    if (!user) {
      this.registerFailure(dto.email);
      throw new UnauthorizedException('Invalid credentials');
    }
    const valid = await bcrypt.compare(dto.password, user.password_hash);
    if (!valid) {
      this.registerFailure(dto.email);
      throw new UnauthorizedException('Invalid credentials');
    }
    // 2FA: при включённой TOTP пароль недостаточен — нужен код.
    if (user.totp_enabled) {
      if (!dto.totp_code) {
        throw new UnauthorizedException('totp_required');
      }
      const result = user.totp_secret
        ? await verifyTotp({ token: dto.totp_code, secret: user.totp_secret })
        : { valid: false };
      if (!result.valid) {
        throw new UnauthorizedException('Неверный код двухфакторной аутентификации');
      }
    }
    this.clearFailures(dto.email);
    return this.buildResponse(user, meta);
  }

  /** Отправка magic link: ответ всегда одинаковый (не раскрываем базу почт). */
  async sendMagicLink(email: string): Promise<{ sent: boolean }> {
    const issued = await this.usersService.issueMagicToken(email);
    if (issued) {
      this.mailService
        .sendMagicLink(issued.user.email, issued.user.name, issued.token)
        .catch(() => undefined);
    }
    return { sent: true };
  }

  /** Вход по одноразовой ссылке. */
  async loginWithMagicToken(
    token: string,
    meta: RequestMeta = {},
  ): Promise<AuthResponseDto> {
    const user = await this.usersService.consumeMagicToken(token);
    this.clearFailures(user.email);
    return this.buildResponse(user, meta);
  }

  /** Запрос сброса пароля: письмо со ссылкой (TTL 1ч). */
  async requestPasswordReset(
    email: string,
    meta: RequestMeta = {},
  ): Promise<{ sent: boolean }> {
    const issued = await this.usersService.issueResetToken(email);
    if (issued) {
      this.mailService
        .sendPasswordReset(
          issued.user.email,
          issued.user.name,
          issued.token,
          deviceFromUserAgent(meta.userAgent),
        )
        .catch(() => undefined);
    }
    return { sent: true };
  }

  /** Установка нового пароля по токену: все прежние сессии отзываются. */
  async resetPassword(
    token: string,
    newPassword: string,
    meta: RequestMeta = {},
  ): Promise<AuthResponseDto> {
    const user = await this.usersService.resetPassword(token, newPassword);
    await this.sessionsService.revokeAll(user.id);
    this.clearFailures(user.email);
    return this.buildResponse(user, meta);
  }

  /**
   * Вход после SSO: провайдер уже подтвердил личность — создаём сессию
   * и выдаём JWT кабинета (2FA при SSO не спрашиваем: её заменяет провайдер).
   */
  async loginWithOauthUser(
    user: User,
    meta: RequestMeta = {},
  ): Promise<AuthResponseDto> {
    this.clearFailures(user.email);
    return this.buildResponse(user, meta);
  }

  /** Шаг 1 подключения 2FA: генерирует секрет и otpauth-URL для QR. */
  async setupTotp(
    userId: string,
  ): Promise<{ secret: string; otpauth_url: string }> {
    const user = await this.usersService.findById(userId);
    if (user.totp_enabled) {
      throw new BadRequestException('2FA уже включена');
    }
    const secret = generateSecret();
    await this.usersService.setTotpSecret(userId, secret, false);
    return {
      secret,
      otpauth_url: generateURI({
        secret,
        issuer: 'Хронос',
        label: user.email,
      }),
    };
  }

  /** Шаг 2: подтверждение кодом — включает 2FA. */
  async enableTotp(userId: string, code: string): Promise<void> {
    const user = await this.usersService.findWithSecrets(userId);
    if (!user.totp_secret) {
      throw new BadRequestException('Сначала запросите QR (setup)');
    }
    const result = await verifyTotp({ token: code, secret: user.totp_secret });
    if (!result.valid) {
      throw new BadRequestException('Неверный код — попробуйте ещё раз');
    }
    await this.usersService.setTotpSecret(userId, user.totp_secret, true);
  }

  async disableTotp(userId: string): Promise<void> {
    await this.usersService.setTotpSecret(userId, null, false);
  }

  /** Общий ответ входа: создаёт сессию и подписывает JWT с её jti. */
  private async buildResponse(
    user: User,
    meta: RequestMeta,
  ): Promise<AuthResponseDto> {
    const session = await this.sessionsService.create(user.id, meta);
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      sid: session.id,
    };
    return {
      access_token: this.jwtService.sign(payload),
      user: { id: user.id, email: user.email, name: user.name },
    };
  }
}
