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
import { TimeEntry } from '../../time-entries/entities/time-entry.entity';
import { PomodoroSession } from '../../pomodoro/entities/pomodoro-session.entity';
import { Project } from '../../projects/entities/project.entity';

export enum TaskStatus {
  TODO = 'todo',
  IN_PROGRESS = 'in_progress',
  DONE = 'done',
}

export enum TaskPriority {
  HIGH = 'high',
  MED = 'med',
  LOW = 'low',
}

@Table({ tableName: 'tasks', timestamps: true })
export class Task extends Model {
  @ApiProperty({ format: 'uuid' })
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column(DataType.UUID)
  id: string;

  @ApiProperty({ example: 'Write project documentation' })
  @Column({ type: DataType.STRING, allowNull: false })
  title: string;

  @ApiProperty({ required: false, nullable: true })
  @Column({ type: DataType.TEXT, allowNull: true })
  description: string | null;

  @ApiProperty({ enum: TaskStatus, example: TaskStatus.TODO })
  @Default(TaskStatus.TODO)
  @Column({
    type: DataType.ENUM(...Object.values(TaskStatus)),
    allowNull: false,
  })
  status: TaskStatus;

  @ApiProperty({
    description: 'Planned/estimated execution time in minutes',
    required: false,
    nullable: true,
    example: 120,
  })
  @Column({ type: DataType.INTEGER, allowNull: true, field: 'estimated_minutes' })
  estimated_minutes: number | null;

  @ApiProperty({ required: false, nullable: true })
  @Column({ type: DataType.DATE, allowNull: true, field: 'completed_at' })
  completed_at: Date | null;

  @ApiProperty()
  @CreatedAt
  @Column({ field: 'created_at' })
  created_at: Date;

  @ApiProperty()
  @UpdatedAt
  @Column({ field: 'updated_at' })
  updated_at: Date;

  @ApiProperty({ format: 'uuid' })
  @ForeignKey(() => User)
  @Column({ type: DataType.UUID, allowNull: false, field: 'user_id' })
  user_id: string;

  @BelongsTo(() => User)
  user: User;

  @ApiProperty({ required: false, nullable: true, format: 'uuid' })
  @ForeignKey(() => Project)
  @Column({ type: DataType.UUID, allowNull: true, field: 'project_id' })
  project_id: string | null;

  @BelongsTo(() => Project)
  project: Project | null;

  @ApiProperty({
    format: 'uuid',
    nullable: true,
    description: 'Исполнитель (по умолчанию — создатель задачи)',
  })
  @ForeignKey(() => User)
  @Column({ type: DataType.UUID, allowNull: true, field: 'assignee_id' })
  assignee_id: string | null;

  @BelongsTo(() => User, 'assignee_id')
  assignee: User | null;

  @ApiProperty({ enum: TaskPriority, example: TaskPriority.MED })
  @Default(TaskPriority.MED)
  @Column({
    type: DataType.ENUM(...Object.values(TaskPriority)),
    allowNull: false,
  })
  priority: TaskPriority;

  @ApiProperty({
    required: false,
    nullable: true,
    example: '2026-08-20',
    description: 'Дедлайн (дата без времени)',
  })
  @Column({ type: DataType.DATEONLY, allowNull: true, field: 'due_date' })
  due_date: string | null;

  @ApiProperty({
    required: false,
    nullable: true,
    example: 'https://notion.so/task-123',
    description: 'Ссылка на задачу во внешней системе (Notion/Jira)',
  })
  @Column({ type: DataType.STRING(1024), allowNull: true, field: 'external_url' })
  external_url: string | null;

  @HasMany(() => TimeEntry)
  time_entries: TimeEntry[];

  @HasMany(() => PomodoroSession)
  pomodoro_sessions: PomodoroSession[];
}
