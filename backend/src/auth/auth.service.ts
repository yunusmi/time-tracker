import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { generateSecret, generateURI, verify as verifyTotp } from 'otplib';
import { UsersService } from '../users/users.service';
import { User } from '../users/entities/user.entity';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { AuthResponseDto } from './dto/auth-response.dto';
import { JwtPayload } from './strategies/jwt.strategy';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
  ) {}

  async register(dto: RegisterDto): Promise<AuthResponseDto> {
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
    return this.buildResponse(user);
  }

  async login(dto: LoginDto): Promise<AuthResponseDto> {
    const user = await this.usersService.findByEmail(dto.email);
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }
    const valid = await bcrypt.compare(dto.password, user.password_hash);
    if (!valid) {
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
    return this.buildResponse(user);
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

  private buildResponse(user: User): AuthResponseDto {
    const payload: JwtPayload = { sub: user.id, email: user.email };
    return {
      access_token: this.jwtService.sign(payload),
      user: { id: user.id, email: user.email, name: user.name },
    };
  }
}
