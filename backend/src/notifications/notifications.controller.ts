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
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiProperty,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { IsObject, IsString } from 'class-validator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { NotificationsService } from './notifications.service';

class PushSubscribeDto {
  @ApiProperty({ description: 'endpoint подписки браузера' })
  @IsString()
  endpoint: string;

  @ApiProperty({ description: 'ключи подписки { p256dh, auth }' })
  @IsObject()
  keys: { p256dh: string; auth: string };
}

@ApiTags('notifications')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  @ApiOperation({
    summary: 'Уведомления: фильтры + курсорная пагинация + непрочитанные',
  })
  @ApiQuery({ name: 'limit', required: false })
  @ApiQuery({
    name: 'filter',
    required: false,
    enum: ['all', 'unread', 'timesheets', 'tasks'],
  })
  @ApiQuery({
    name: 'before',
    required: false,
    description: 'created_at курсор — вернуть более старые',
  })
  async list(
    @CurrentUser('id') userId: string,
    @Query('limit') limit?: string,
    @Query('filter') filter?: 'all' | 'unread' | 'timesheets' | 'tasks',
    @Query('before') before?: string,
  ) {
    const items = await this.notificationsService.list(userId, {
      limit: limit ? Number(limit) : undefined,
      filter,
      before,
    });
    const unread = await this.notificationsService.unreadCount(userId);
    return { items, unread };
  }

  @Get('push/key')
  @ApiOperation({ summary: 'Публичный VAPID-ключ для Web Push' })
  vapidKey() {
    return this.notificationsService.getVapidPublicKey();
  }

  @Post('push/subscribe')
  @HttpCode(204)
  @ApiOperation({ summary: 'Подписаться на Web Push' })
  async subscribe(
    @CurrentUser('id') userId: string,
    @Body() dto: PushSubscribeDto,
  ): Promise<void> {
    await this.notificationsService.subscribePush(
      userId,
      dto.endpoint,
      dto.keys,
    );
  }

  @Post('push/unsubscribe')
  @HttpCode(204)
  @ApiOperation({ summary: 'Отписаться от Web Push' })
  async unsubscribe(
    @CurrentUser('id') userId: string,
    @Body() dto: { endpoint: string },
  ): Promise<void> {
    await this.notificationsService.unsubscribePush(
      userId,
      dto.endpoint ?? '',
    );
  }

  @Post('read-all')
  @HttpCode(204)
  @ApiOperation({ summary: 'Пометить все прочитанными' })
  async readAll(@CurrentUser('id') userId: string): Promise<void> {
    await this.notificationsService.markAllRead(userId);
  }

  @Post(':id/read')
  @HttpCode(204)
  @ApiOperation({ summary: 'Пометить одно прочитанным' })
  async readOne(
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    await this.notificationsService.markRead(userId, id);
  }

  @Delete(':id')
  @HttpCode(204)
  @ApiOperation({ summary: 'Удалить одно уведомление' })
  async removeOne(
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    await this.notificationsService.removeOne(userId, id);
  }

  @Delete()
  @HttpCode(204)
  @ApiOperation({ summary: 'Очистить все уведомления' })
  async clear(@CurrentUser('id') userId: string): Promise<void> {
    await this.notificationsService.clear(userId);
  }
}
