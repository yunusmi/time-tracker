import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { UsersService } from './users.service';
import { UserSettingsService } from './user-settings.service';
import { UpdateUserSettingsDto } from './dto/update-user-settings.dto';
import {
  ChangePasswordDto,
  DeleteAccountDto,
  UpdateAvatarDto,
  UpdateProfileDto,
} from './dto/update-profile.dto';
import { UserSettings } from './entities/user-settings.entity';
import { User } from './entities/user.entity';
import { AuthenticatedUser } from '../auth/strategies/jwt.strategy';

@ApiTags('users')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('users')
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly userSettingsService: UserSettingsService,
  ) {}

  @Patch('me')
  @ApiOperation({
    summary: 'Update profile (name, email; email change resets verification)',
  })
  @ApiResponse({ status: 200, type: User })
  updateProfile(
    @CurrentUser('id') userId: string,
    @Body() dto: UpdateProfileDto,
  ): Promise<User> {
    return this.usersService.updateProfile(userId, dto);
  }

  @Post('me/password')
  @HttpCode(204)
  @ApiOperation({ summary: 'Change password' })
  @ApiResponse({ status: 204, description: 'Password changed' })
  async changePassword(
    @CurrentUser('id') userId: string,
    @Body() dto: ChangePasswordDto,
  ): Promise<void> {
    await this.usersService.changePassword(
      userId,
      dto.current_password,
      dto.new_password,
    );
  }

  @Get('me/settings')
  @ApiOperation({ summary: 'Get current user settings (created on first call)' })
  @ApiResponse({ status: 200, type: UserSettings })
  getSettings(@CurrentUser('id') userId: string): Promise<UserSettings> {
    return this.userSettingsService.getOrCreate(userId);
  }

  @Patch('me/settings')
  @ApiOperation({ summary: 'Update current user settings' })
  @ApiResponse({ status: 200, type: UserSettings })
  updateSettings(
    @CurrentUser('id') userId: string,
    @Body() dto: UpdateUserSettingsDto,
  ): Promise<UserSettings> {
    return this.userSettingsService.update(userId, dto);
  }

  @Patch('me/avatar')
  @ApiOperation({ summary: 'Загрузить/снять фото профиля (data-URL 128px)' })
  @ApiResponse({ status: 200, type: User })
  updateAvatar(
    @CurrentUser('id') userId: string,
    @Body() dto: UpdateAvatarDto,
  ): Promise<User> {
    return this.usersService.setAvatar(userId, dto.avatar_url ?? null);
  }

  @Get('me/export')
  @ApiOperation({ summary: 'Экспорт всех моих данных (GDPR, JSON)' })
  exportData(@CurrentUser('id') userId: string) {
    return this.usersService.exportData(userId);
  }

  @Post('me/delete')
  @HttpCode(204)
  @ApiOperation({
    summary: 'Удалить аккаунт (подтверждение: ввод собственного email)',
  })
  async deleteAccount(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: DeleteAccountDto,
  ): Promise<void> {
    if (dto.email.trim().toLowerCase() !== user.email.toLowerCase()) {
      throw new BadRequestException('Email не совпадает с вашим аккаунтом');
    }
    await this.usersService.removeAccount(user.id);
  }
}
