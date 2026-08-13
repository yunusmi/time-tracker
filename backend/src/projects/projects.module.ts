import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { Project } from './entities/project.entity';
import { Task } from '../tasks/entities/task.entity';
import { TimeEntry } from '../time-entries/entities/time-entry.entity';
import { WorkspacesModule } from '../workspaces/workspaces.module';
import { ProjectsController } from './projects.controller';
import { ProjectsService } from './projects.service';

@Module({
  imports: [
    SequelizeModule.forFeature([Project, Task, TimeEntry]),
    WorkspacesModule,
  ],
  controllers: [ProjectsController],
  providers: [ProjectsService],
  exports: [ProjectsService],
})
export class ProjectsModule {}
