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
  UpdatedAt,
} from 'sequelize-typescript';
import { User } from '../../users/entities/user.entity';
import { Workspace } from '../../workspaces/entities/workspace.entity';

export enum TimesheetStatus {
  DRAFT = 'draft',
  PENDING = 'pending',
  APPROVED = 'approved',
  RETURNED = 'returned',
}

@Table({
  tableName: 'timesheets',
  timestamps: true,
  indexes: [{ unique: true, fields: ['user_id', 'week_start'] }],
})
export class Timesheet extends Model {
  @ApiProperty({ format: 'uuid' })
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column(DataType.UUID)
  id: string;

  @ApiProperty({ format: 'uuid' })
  @ForeignKey(() => User)
  @Column({ type: DataType.UUID, allowNull: false, field: 'user_id' })
  user_id: string;

  @BelongsTo(() => User, 'user_id')
  user: User;

  @ApiProperty({ format: 'uuid' })
  @ForeignKey(() => Workspace)
  @Column({ type: DataType.UUID, allowNull: false, field: 'workspace_id' })
  workspace_id: string;

  @BelongsTo(() => Workspace)
  workspace: Workspace;

  @ApiProperty({ example: '2026-08-10', description: 'Понедельник недели (UTC)' })
  @Column({ type: DataType.DATEONLY, allowNull: false, field: 'week_start' })
  week_start: string;

  @ApiProperty({ enum: TimesheetStatus, example: TimesheetStatus.PENDING })
  @Default(TimesheetStatus.DRAFT)
  @Column({
    type: DataType.ENUM(...Object.values(TimesheetStatus)),
    allowNull: false,
  })
  status: TimesheetStatus;

  @ApiProperty({
    required: false,
    nullable: true,
    description: 'Комментарий админа при возврате на доработку',
  })
  @Column({ type: DataType.TEXT, allowNull: true })
  comment: string | null;

  @ApiProperty({ required: false, nullable: true, format: 'uuid' })
  @ForeignKey(() => User)
  @Column({ type: DataType.UUID, allowNull: true, field: 'approved_by' })
  approved_by: string | null;

  @ApiProperty()
  @CreatedAt
  @Column({ field: 'created_at' })
  created_at: Date;

  @ApiProperty()
  @UpdatedAt
  @Column({ field: 'updated_at' })
  updated_at: Date;
}
