import {
  Controller,
  Delete,
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
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { NotificationsService } from './notifications.service';

@ApiTags('notifications')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  @ApiOperation({ summary: 'Последние уведомления + число непрочитанных' })
  @ApiQuery({ name: 'limit', required: false })
  async list(
    @CurrentUser('id') userId: string,
    @Query('limit') limit?: string,
  ) {
    const items = await this.notificationsService.list(
      userId,
      limit ? Number(limit) : undefined,
    );
    const unread = await this.notificationsService.unreadCount(userId);
    return { items, unread };
  }

  @Post('read-all')
  @HttpCode(204)
  @ApiOperation({ summary: 'Пометить все прочитанными' })
  async readAll(@CurrentUser('id') userId: string): Promise<void> {
    await this.notificationsService.markAllRead(userId);
  }

  @Delete()
  @HttpCode(204)
  @ApiOperation({ summary: 'Очистить все уведомления' })
  async clear(@CurrentUser('id') userId: string): Promise<void> {
    await this.notificationsService.clear(userId);
  }
}
