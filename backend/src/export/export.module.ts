import { Module } from '@nestjs/common';
import { ExportService } from './export.service';
import { ExportController } from './export.controller';
import { TasksModule } from '../tasks/tasks.module';
import { TimeEntriesModule } from '../time-entries/time-entries.module';
import { PomodoroModule } from '../pomodoro/pomodoro.module';

@Module({
  imports: [TasksModule, TimeEntriesModule, PomodoroModule],
  providers: [ExportService],
  controllers: [ExportController],
})
export class ExportModule {}
