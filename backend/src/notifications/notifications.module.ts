import { Global, Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { AppNotification } from './notification.entity';
import { PushSubscription } from './push-subscription.entity';
import { UserSettings } from '../users/entities/user-settings.entity';
import { NotificationsService } from './notifications.service';
import { NotificationsController } from './notifications.controller';

@Global()
@Module({
  imports: [
    SequelizeModule.forFeature([AppNotification, PushSubscription, UserSettings]),
  ],
  controllers: [NotificationsController],
  providers: [NotificationsService],
  exports: [NotificationsService],
})
export class NotificationsModule {}
