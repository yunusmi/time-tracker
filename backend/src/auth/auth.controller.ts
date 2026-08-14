import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { AuthService, RequestMeta } from './auth.service';
import { SessionsService } from './sessions.service';
import { UsersService } from '../users/users.service';
import { MailService } from '../mail/mail.service';
import { RegisterDto } from './dto/register.dto';
import {
  ForgotPasswordDto,
  LoginDto,
  MagicLinkDto,
  ResetPasswordDto,
} from './dto/login.dto';
import { AuthResponseDto, AuthUserDto } from './dto/auth-response.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { CurrentUser } from './decorators/current-user.decorator';
import { AuthenticatedUser } from './strategies/jwt.strategy';

/** Метаданные запроса (устройство и IP) для сессий и писем. */
function metaOf(req: Request): RequestMeta {
  return {
    userAgent: req.headers['user-agent'],
    ip:
      (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
      req.ip,
  };
}

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly sessionsService: SessionsService,
    private readonly usersService: UsersService,
    private readonly mailService: MailService,
  ) {}

  @Post('register')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiOperation({ summary: 'Register a new user' })
  @ApiResponse({ status: 201, type: AuthResponseDto })
  register(
    @Body() dto: RegisterDto,
    @Req() req: Request,
  ): Promise<AuthResponseDto> {
    return this.authService.register(dto, metaOf(req));
  }

  @Post('login')
  @HttpCode(200)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiOperation({ summary: 'Log in and receive a JWT' })
  @ApiResponse({ status: 200, type: AuthResponseDto })
  login(
    @Body() dto: LoginDto,
    @Req() req: Request,
  ): Promise<AuthResponseDto> {
    return this.authService.login(dto, metaOf(req));
  }

  @Get('captcha-required')
  @ApiOperation({
    summary: 'Нужна ли капча для этой почты (после 2 неудачных попыток)',
  })
  @ApiQuery({ name: 'email', required: true })
  captchaRequired(@Query('email') email: string): { required: boolean } {
    return { required: this.authService.captchaRequired(email ?? '') };
  }

  @Post('magic-link')
  @HttpCode(200)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiOperation({ summary: 'Прислать ссылку для входа без пароля (TTL 15 мин)' })
  magicLink(@Body() dto: MagicLinkDto): Promise<{ sent: boolean }> {
    return this.authService.sendMagicLink(dto.email);
  }

  @Post('magic-login')
  @HttpCode(200)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiOperation({ summary: 'Войти по одноразовой ссылке из письма' })
  @ApiResponse({ status: 200, type: AuthResponseDto })
  magicLogin(
    @Body() body: { token: string },
    @Req() req: Request,
  ): Promise<AuthResponseDto> {
    return this.authService.loginWithMagicToken(body.token ?? '', metaOf(req));
  }

  @Post('forgot-password')
  @HttpCode(200)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiOperation({ summary: 'Письмо со ссылкой сброса пароля (TTL 1ч)' })
  forgotPassword(
    @Body() dto: ForgotPasswordDto,
    @Req() req: Request,
  ): Promise<{ sent: boolean }> {
    return this.authService.requestPasswordReset(dto.email, metaOf(req));
  }

  @Post('reset-password')
  @HttpCode(200)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiOperation({
    summary: 'Задать новый пароль по токену (все прежние сессии отзываются)',
  })
  @ApiResponse({ status: 200, type: AuthResponseDto })
  resetPassword(
    @Body() dto: ResetPasswordDto,
    @Req() req: Request,
  ): Promise<AuthResponseDto> {
    return this.authService.resetPassword(
      dto.token,
      dto.new_password,
      metaOf(req),
    );
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get the currently authenticated user' })
  @ApiResponse({ status: 200, type: AuthUserDto })
  me(@CurrentUser() user: AuthenticatedUser): AuthUserDto {
    return user;
  }

  // --- Сессии и устройства ---

  @Get('sessions')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Активные сессии (устройство, IP, последний вход)' })
  async sessions(@CurrentUser() user: AuthenticatedUser) {
    const rows = await this.sessionsService.list(user.id);
    return rows.map((s) => ({
      id: s.id,
      device: s.device,
      ip: s.ip,
      last_seen: s.last_seen,
      created_at: s.created_at,
      current: s.id === user.session_id,
    }));
  }

  @Delete('sessions/:id')
  @HttpCode(204)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Завершить сессию' })
  revokeSession(
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    return this.sessionsService.revoke(userId, id);
  }

  @Post('sessions/revoke-all')
  @HttpCode(204)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Выйти везде (кроме текущего устройства)' })
  async revokeAll(@CurrentUser() user: AuthenticatedUser): Promise<void> {
    await this.sessionsService.revokeAll(user.id, user.session_id ?? undefined);
  }

  @Post('verify/send')
  @HttpCode(200)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Send an email-verification link (TTL 24h)' })
  @ApiResponse({ status: 200, description: 'Письмо отправлено' })
  async sendVerify(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ sent: boolean }> {
    const { user: fresh, token } = await this.usersService.issueVerifyToken(
      user.id,
    );
    await this.mailService.sendVerification(fresh.email, fresh.name, token);
    return { sent: true };
  }

  @Post('2fa/setup')
  @HttpCode(200)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Начать подключение 2FA: секрет + otpauth-URL' })
  setup2fa(@CurrentUser('id') userId: string) {
    return this.authService.setupTotp(userId);
  }

  @Post('2fa/enable')
  @HttpCode(204)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Подтвердить код и включить 2FA' })
  async enable2fa(
    @CurrentUser('id') userId: string,
    @Body() body: { code: string },
  ): Promise<void> {
    await this.authService.enableTotp(userId, body.code ?? '');
  }

  @Post('2fa/disable')
  @HttpCode(204)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Отключить 2FA' })
  async disable2fa(@CurrentUser('id') userId: string): Promise<void> {
    await this.authService.disableTotp(userId);
  }

  @Get('verify')
  @ApiOperation({ summary: 'Confirm email by one-time token' })
  @ApiQuery({ name: 'token', required: true })
  @ApiResponse({ status: 200, description: 'Почта подтверждена' })
  async verify(
    @Query('token') token: string,
  ): Promise<{ verified: boolean; email: string }> {
    const user = await this.usersService.verifyEmail(token);
    return { verified: true, email: user.email };
  }
}
