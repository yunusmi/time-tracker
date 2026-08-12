import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { User } from './entities/user.entity';
import { UserSettings } from './entities/user-settings.entity';
import { UsersService } from './users.service';
import { UserSettingsService } from './user-settings.service';
import { UsersController } from './users.controller';

@Module({
  imports: [SequelizeModule.forFeature([User, UserSettings])],
  providers: [UsersService, UserSettingsService],
  controllers: [UsersController],
  exports: [UsersService, UserSettingsService],
})
export class UsersModule {}
