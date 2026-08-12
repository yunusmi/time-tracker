import { ApiProperty } from '@nestjs/swagger';
import {
  Column,
  CreatedAt,
  DataType,
  Default,
  HasMany,
  HasOne,
  Model,
  PrimaryKey,
  Scopes,
  Table,
  Unique,
} from 'sequelize-typescript';
import { Task } from '../../tasks/entities/task.entity';
import { TimeEntry } from '../../time-entries/entities/time-entry.entity';
import { PomodoroSession } from '../../pomodoro/entities/pomodoro-session.entity';
import { PomodoroSettings } from '../../pomodoro/entities/pomodoro-settings.entity';

@Scopes(() => ({
  withPassword: { attributes: { include: ['password_hash'] } },
}))
@Table({
  tableName: 'users',
  timestamps: true,
  updatedAt: false,
  defaultScope: { attributes: { exclude: ['password_hash'] } },
})
export class User extends Model {
  @ApiProperty({ format: 'uuid' })
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column(DataType.UUID)
  id: string;

  @ApiProperty({ example: 'user@example.com' })
  @Unique
  @Column({ type: DataType.STRING, allowNull: false })
  email: string;

  @ApiProperty({ example: 'John Doe' })
  @Column({ type: DataType.STRING, allowNull: false })
  name: string;

  // Excluded from queries by default scope; only loaded via `withPassword`.
  @Column({ type: DataType.STRING, allowNull: false, field: 'password_hash' })
  password_hash: string;

  @ApiProperty()
  @CreatedAt
  @Column({ field: 'created_at' })
  created_at: Date;

  @HasMany(() => Task)
  tasks: Task[];

  @HasMany(() => TimeEntry)
  time_entries: TimeEntry[];

  @HasMany(() => PomodoroSession)
  pomodoro_sessions: PomodoroSession[];

  @HasOne(() => PomodoroSettings)
  pomodoro_settings: PomodoroSettings;
}
