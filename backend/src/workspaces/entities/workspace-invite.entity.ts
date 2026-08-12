import { ApiProperty } from '@nestjs/swagger';
import {
  BelongsTo,
  Column,
  CreatedAt,
  DataType,
  Default,
  ForeignKey,
  Model,
  PrimaryKey,
  Table,
  Unique,
} from 'sequelize-typescript';
import { Workspace } from './workspace.entity';
import { WorkspaceRole } from './workspace-member.entity';

export enum InviteStatus {
  PENDING = 'pending',
  REVOKED = 'revoked',
  ACCEPTED = 'accepted',
}

@Table({ tableName: 'workspace_invites', timestamps: true, updatedAt: false })
export class WorkspaceInvite extends Model {
  @ApiProperty({ format: 'uuid' })
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column(DataType.UUID)
  id: string;

  @ApiProperty({ format: 'uuid' })
  @ForeignKey(() => Workspace)
  @Column({ type: DataType.UUID, allowNull: false, field: 'workspace_id' })
  workspace_id: string;

  @BelongsTo(() => Workspace)
  workspace: Workspace;

  @ApiProperty({ example: 'colleague@example.com' })
  @Column({ type: DataType.STRING, allowNull: false })
  email: string;

  @ApiProperty({ enum: WorkspaceRole, example: WorkspaceRole.MEMBER })
  @Default(WorkspaceRole.MEMBER)
  @Column({
    type: DataType.ENUM(...Object.values(WorkspaceRole)),
    allowNull: false,
  })
  role: WorkspaceRole;

  @ApiProperty({ description: 'Секретный токен из ссылки-приглашения' })
  @Unique
  @Column({ type: DataType.STRING(64), allowNull: false })
  token: string;

  @ApiProperty({ enum: InviteStatus, example: InviteStatus.PENDING })
  @Default(InviteStatus.PENDING)
  @Column({
    type: DataType.ENUM(...Object.values(InviteStatus)),
    allowNull: false,
  })
  status: InviteStatus;

  @ApiProperty()
  @CreatedAt
  @Column({ field: 'created_at' })
  created_at: Date;
}
