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
import { Task } from '../../tasks/entities/task.entity';

@Table({ tableName: 'time_entries', timestamps: true, updatedAt: false })
export class TimeEntry extends Model {
  @ApiProperty({ format: 'uuid' })
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column(DataType.UUID)
  id: string;

  @ApiProperty({ required: false, nullable: true })
  @Column({ type: DataType.TEXT, allowNull: true })
  description: string | null;

  @ApiProperty({ description: 'When tracking started' })
  @Column({ type: DataType.DATE, allowNull: false, field: 'started_at' })
  started_at: Date;

  @ApiProperty({
    description: 'When tracking stopped. Null means the timer is still running.',
    required: false,
    nullable: true,
  })
  @Column({ type: DataType.DATE, allowNull: true, field: 'ended_at' })
  ended_at: Date | null;

  @ApiProperty({
    description: 'Tracked duration in seconds (0 while timer is running)',
    example: 3600,
  })
  @Default(0)
  @Column({ type: DataType.INTEGER, allowNull: false, field: 'duration_seconds' })
  duration_seconds: number;

  @ApiProperty({
    description: 'True when the entry was created from explicit start/end times',
    example: false,
  })
  @Default(false)
  @Column({ type: DataType.BOOLEAN, allowNull: false, field: 'is_manual' })
  is_manual: boolean;

  @ApiProperty()
  @CreatedAt
  @Column({ field: 'created_at' })
  created_at: Date;

  @ApiProperty({ format: 'uuid' })
  @ForeignKey(() => User)
  @Column({ type: DataType.UUID, allowNull: false, field: 'user_id' })
  user_id: string;

  @BelongsTo(() => User)
  user: User;

  @ApiProperty({ required: false, nullable: true, format: 'uuid' })
  @ForeignKey(() => Task)
  @Column({ type: DataType.UUID, allowNull: true, field: 'task_id' })
  task_id: string | null;

  @BelongsTo(() => Task)
  task: Task | null;
}
