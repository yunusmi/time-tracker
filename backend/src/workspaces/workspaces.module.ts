import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { Workspace } from './entities/workspace.entity';
import { WorkspaceMember } from './entities/workspace-member.entity';
import { WorkspaceInvite } from './entities/workspace-invite.entity';
import { User } from '../users/entities/user.entity';
import { TimeEntry } from '../time-entries/entities/time-entry.entity';
import { WorkspacesController } from './workspaces.controller';
import { WorkspacesService } from './workspaces.service';

@Module({
  imports: [
    SequelizeModule.forFeature([
      Workspace,
      WorkspaceMember,
      WorkspaceInvite,
      User,
      TimeEntry,
    ]),
  ],
  controllers: [WorkspacesController],
  providers: [WorkspacesService],
  exports: [WorkspacesService],
})
export class WorkspacesModule {}
