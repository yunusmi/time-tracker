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

export enum PomodoroPhase {
  WORK = 'work',
  SHORT_BREAK = 'short_break',
  LONG_BREAK = 'long_break',
}

@Table({ tableName: 'pomodoro_sessions', timestamps: true, updatedAt: false })
export class PomodoroSession extends Model {
  @ApiProperty({ format: 'uuid' })
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column(DataType.UUID)
  id: string;

  @ApiProperty({ enum: PomodoroPhase, example: PomodoroPhase.WORK })
  @Default(PomodoroPhase.WORK)
  @Column({
    type: DataType.ENUM(...Object.values(PomodoroPhase)),
    allowNull: false,
  })
  phase: PomodoroPhase;

  @ApiProperty({ description: 'Session length in seconds', example: 1500 })
  @Column({ type: DataType.INTEGER, allowNull: false, field: 'duration_seconds' })
  duration_seconds: number;

  @ApiProperty({ description: 'Whether the interval ran to completion' })
  @Default(true)
  @Column({ type: DataType.BOOLEAN, allowNull: false })
  completed: boolean;

  @ApiProperty()
  @Column({ type: DataType.DATE, allowNull: false, field: 'started_at' })
  started_at: Date;

  @ApiProperty()
  @Column({ type: DataType.DATE, allowNull: false, field: 'ended_at' })
  ended_at: Date;

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
