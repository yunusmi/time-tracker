import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { PomodoroSettings } from './entities/pomodoro-settings.entity';
import { PomodoroSession } from './entities/pomodoro-session.entity';
import { PomodoroService } from './pomodoro.service';
import { PomodoroController } from './pomodoro.controller';
import { TasksModule } from '../tasks/tasks.module';

@Module({
  imports: [
    SequelizeModule.forFeature([PomodoroSettings, PomodoroSession]),
    TasksModule,
  ],
  providers: [PomodoroService],
  controllers: [PomodoroController],
  exports: [PomodoroService],
})
export class PomodoroModule {}
