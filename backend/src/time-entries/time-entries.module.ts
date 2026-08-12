import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { TimeEntry } from './entities/time-entry.entity';
import { TimeEntriesService } from './time-entries.service';
import { TimeEntriesController } from './time-entries.controller';
import { TasksModule } from '../tasks/tasks.module';

@Module({
  imports: [SequelizeModule.forFeature([TimeEntry]), TasksModule],
  providers: [TimeEntriesService],
  controllers: [TimeEntriesController],
  exports: [TimeEntriesService],
})
export class TimeEntriesModule {}
