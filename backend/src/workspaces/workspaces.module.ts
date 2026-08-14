import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { Workspace } from './entities/workspace.entity';
import { WorkspaceMember } from './entities/workspace-member.entity';
import { WorkspaceInvite } from './entities/workspace-invite.entity';
import { Department } from './entities/department.entity';
import { Absence } from './entities/absence.entity';
import { User } from '../users/entities/user.entity';
import { TimeEntry } from '../time-entries/entities/time-entry.entity';
import { WorkspacesController } from './workspaces.controller';
import { WorkspacesService } from './workspaces.service';
import { AuditController } from '../audit/audit.controller';

@Module({
  imports: [
    SequelizeModule.forFeature([
      Workspace,
      WorkspaceMember,
      WorkspaceInvite,
      Department,
      Absence,
      User,
      TimeEntry,
    ]),
  ],
  controllers: [WorkspacesController, AuditController],
  providers: [WorkspacesService],
  exports: [WorkspacesService],
})
export class WorkspacesModule {}
