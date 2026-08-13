import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { Task } from './entities/task.entity';
import { TaskTemplate } from './entities/task-template.entity';
import { TimeEntry } from '../time-entries/entities/time-entry.entity';
import { PomodoroSession } from '../pomodoro/entities/pomodoro-session.entity';
import { Project } from '../projects/entities/project.entity';
import { WorkspacesModule } from '../workspaces/workspaces.module';
import { TasksService } from './tasks.service';
import { TasksController } from './tasks.controller';
import { TaskTemplatesController } from './task-templates.controller';

@Module({
  imports: [
    SequelizeModule.forFeature([
      Task,
      TaskTemplate,
      TimeEntry,
      PomodoroSession,
      Project,
    ]),
    WorkspacesModule,
  ],
  providers: [TasksService],
  controllers: [TasksController, TaskTemplatesController],
  exports: [TasksService],
})
export class TasksModule {}
