import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { Task } from './entities/task.entity';
import { TimeEntry } from '../time-entries/entities/time-entry.entity';
import { PomodoroSession } from '../pomodoro/entities/pomodoro-session.entity';
import { TasksService } from './tasks.service';
import { TasksController } from './tasks.controller';

@Module({
  imports: [SequelizeModule.forFeature([Task, TimeEntry, PomodoroSession])],
  providers: [TasksService],
  controllers: [TasksController],
  exports: [TasksService],
})
export class TasksModule {}
