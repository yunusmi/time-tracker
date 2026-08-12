import { ApiProperty } from '@nestjs/swagger';
import {
  BelongsTo,
  Column,
  CreatedAt,
  DataType,
  Default,
  ForeignKey,
  HasMany,
  Model,
  PrimaryKey,
  Table,
  UpdatedAt,
} from 'sequelize-typescript';
import { User } from '../../users/entities/user.entity';
import { WorkspaceMember } from './workspace-member.entity';
import { WorkspaceInvite } from './workspace-invite.entity';

@Table({ tableName: 'workspaces', timestamps: true })
export class Workspace extends Model {
  @ApiProperty({ format: 'uuid' })
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column(DataType.UUID)
  id: string;

  @ApiProperty({ example: 'Команда Хронос' })
  @Column({ type: DataType.STRING, allowNull: false })
  name: string;

  @ApiProperty({ format: 'uuid' })
  @ForeignKey(() => User)
  @Column({ type: DataType.UUID, allowNull: false, field: 'owner_id' })
  owner_id: string;

  @BelongsTo(() => User)
  owner: User;

  @ApiProperty()
  @CreatedAt
  @Column({ field: 'created_at' })
  created_at: Date;

  @ApiProperty()
  @UpdatedAt
  @Column({ field: 'updated_at' })
  updated_at: Date;

  @HasMany(() => WorkspaceMember)
  members: WorkspaceMember[];

  @HasMany(() => WorkspaceInvite)
  invites: WorkspaceInvite[];
}
