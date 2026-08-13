import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';
import { MailService } from '../mail/mail.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { AuthResponseDto, AuthUserDto } from './dto/auth-response.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { CurrentUser } from './decorators/current-user.decorator';
import { AuthenticatedUser } from './strategies/jwt.strategy';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly usersService: UsersService,
    private readonly mailService: MailService,
  ) {}

  @Post('register')
  @ApiOperation({ summary: 'Register a new user' })
  @ApiResponse({ status: 201, type: AuthResponseDto })
  register(@Body() dto: RegisterDto): Promise<AuthResponseDto> {
    return this.authService.register(dto);
  }

  @Post('login')
  @HttpCode(200)
  @ApiOperation({ summary: 'Log in and receive a JWT' })
  @ApiResponse({ status: 200, type: AuthResponseDto })
  login(@Body() dto: LoginDto): Promise<AuthResponseDto> {
    return this.authService.login(dto);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get the currently authenticated user' })
  @ApiResponse({ status: 200, type: AuthUserDto })
  me(@CurrentUser() user: AuthenticatedUser): AuthUserDto {
    return user;
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
