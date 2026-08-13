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
import { User } from '../users/entities/user.entity';
import { Workspace } from '../workspaces/entities/workspace.entity';

@Table({ tableName: 'audit_log', timestamps: true, updatedAt: false })
export class AuditLog extends Model {
  @ApiProperty({ format: 'uuid' })
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column(DataType.UUID)
  id: string;

  @ApiProperty({ format: 'uuid' })
  @ForeignKey(() => Workspace)
  @Column({ type: DataType.UUID, allowNull: false, field: 'workspace_id' })
  workspace_id: string;

  @ApiProperty({ format: 'uuid' })
  @ForeignKey(() => User)
  @Column({ type: DataType.UUID, allowNull: false, field: 'user_id' })
  user_id: string;

  @BelongsTo(() => User)
  user: User;

  @ApiProperty({ example: 'создал задачу «API интеграции платежей»' })
  @Column({ type: DataType.TEXT, allowNull: false })
  action: string;

  @ApiProperty({ required: false, nullable: true, example: 'task' })
  @Column({ type: DataType.STRING(32), allowNull: true, field: 'entity_type' })
  entity_type: string | null;

  @ApiProperty({ required: false, nullable: true, format: 'uuid' })
  @Column({ type: DataType.UUID, allowNull: true, field: 'entity_id' })
  entity_id: string | null;

  @ApiProperty({ required: false, nullable: true })
  @Column({ type: DataType.JSONB, allowNull: true })
  meta: Record<string, unknown> | null;

  @ApiProperty()
  @CreatedAt
  @Column({ field: 'created_at' })
  created_at: Date;
}
