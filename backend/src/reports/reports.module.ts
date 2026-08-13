import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { ReportShare } from './report-share.entity';
import { TimeEntry } from '../time-entries/entities/time-entry.entity';
import { Task } from '../tasks/entities/task.entity';
import { Project } from '../projects/entities/project.entity';
import { User } from '../users/entities/user.entity';
import { UserSettings } from '../users/entities/user-settings.entity';
import { WorkspacesModule } from '../workspaces/workspaces.module';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';
import { StandupService } from './standup.service';

@Module({
  imports: [
    SequelizeModule.forFeature([
      ReportShare,
      TimeEntry,
      Task,
      Project,
      User,
      UserSettings,
    ]),
    WorkspacesModule,
  ],
  controllers: [ReportsController],
  providers: [ReportsService, StandupService],
  exports: [StandupService],
})
export class ReportsModule {}
