import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { User } from './entities/user.entity';
import { UserSettings } from './entities/user-settings.entity';
import { Task } from '../tasks/entities/task.entity';
import { TimeEntry } from '../time-entries/entities/time-entry.entity';
import { Project } from '../projects/entities/project.entity';
import { UsersService } from './users.service';
import { UserSettingsService } from './user-settings.service';
import { UsersController } from './users.controller';

@Module({
  imports: [
    SequelizeModule.forFeature([User, UserSettings, Task, TimeEntry, Project]),
  ],
  providers: [UsersService, UserSettingsService],
  controllers: [UsersController],
  exports: [UsersService, UserSettingsService],
})
export class UsersModule {}
