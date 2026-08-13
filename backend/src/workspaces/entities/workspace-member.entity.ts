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
} from 'sequelize-typescript';
import { User } from '../../users/entities/user.entity';
import { Workspace } from './workspace.entity';

export enum WorkspaceRole {
  OWNER = 'owner',
  ADMIN = 'admin',
  /** Менеджер проекта: задачи и отчёты только своего проекта, без денег. */
  PM = 'pm',
  MEMBER = 'member',
  /** Клиент: только отчёты своего проекта, read-only. */
  CLIENT = 'client',
}

/** Роли с правами администрирования (проекты, инвайты, чужие данные). */
export const ADMIN_ROLES: WorkspaceRole[] = [
  WorkspaceRole.OWNER,
  WorkspaceRole.ADMIN,
];

@Table({
  tableName: 'workspace_members',
  timestamps: true,
  updatedAt: false,
  indexes: [{ unique: true, fields: ['workspace_id', 'user_id'] }],
})
export class WorkspaceMember extends Model {
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

  @ApiProperty({ format: 'uuid' })
  @ForeignKey(() => User)
  @Column({ type: DataType.UUID, allowNull: false, field: 'user_id' })
  user_id: string;

  @BelongsTo(() => User)
  user: User;

  @ApiProperty({ enum: WorkspaceRole, example: WorkspaceRole.MEMBER })
  @Default(WorkspaceRole.MEMBER)
  @Column({
    type: DataType.ENUM(...Object.values(WorkspaceRole)),
    allowNull: false,
  })
  role: WorkspaceRole;

  @ApiProperty({
    required: false,
    nullable: true,
    format: 'uuid',
    description: 'Проект, к которому привязаны роли pm/client',
  })
  @Column({ type: DataType.UUID, allowNull: true, field: 'project_id' })
  project_id: string | null;

  @ApiProperty()
  @CreatedAt
  @Column({ field: 'created_at' })
  created_at: Date;
}
