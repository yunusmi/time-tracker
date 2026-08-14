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
  defaultScope: {
    attributes: {
      exclude: [
        'password_hash',
        'verify_token',
        'totp_secret',
        'reset_token',
        'magic_token',
      ],
    },
  },
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

  @ApiProperty({
    required: false,
    nullable: true,
    description: 'Когда почта была подтверждена (null — не подтверждена)',
  })
  @Column({ type: DataType.DATE, allowNull: true, field: 'email_verified_at' })
  email_verified_at: Date | null;

  // Одноразовый токен верификации почты (исключён из выдачи по умолчанию).
  @Column({ type: DataType.STRING(64), allowNull: true, field: 'verify_token' })
  verify_token: string | null;

  @Column({
    type: DataType.DATE,
    allowNull: true,
    field: 'verify_token_expires',
  })
  verify_token_expires: Date | null;

  // Секрет TOTP (исключён из выдачи по умолчанию).
  @Column({ type: DataType.STRING(64), allowNull: true, field: 'totp_secret' })
  totp_secret: string | null;

  @ApiProperty({ description: 'Включена ли двухфакторная аутентификация' })
  @Default(false)
  @Column({ type: DataType.BOOLEAN, allowNull: false, field: 'totp_enabled' })
  totp_enabled: boolean;

  @ApiProperty({
    required: false,
    nullable: true,
    description: 'Аватар (data-URL 128px после client-side crop) — иначе инициалы',
  })
  @Column({ type: DataType.TEXT, allowNull: true, field: 'avatar_url' })
  avatar_url: string | null;

  @ApiProperty({
    required: false,
    nullable: true,
    example: 'google',
    description: 'Провайдер SSO, через которого создан аккаунт (google/yandex)',
  })
  @Column({
    type: DataType.STRING(16),
    allowNull: true,
    field: 'oauth_provider',
  })
  oauth_provider: string | null;

  @ApiProperty({
    required: false,
    nullable: true,
    format: 'uuid',
    description: 'Выбранная компания (переключатель в сайдбаре)',
  })
  @Column({
    type: DataType.UUID,
    allowNull: true,
    field: 'active_workspace_id',
  })
  active_workspace_id: string | null;

  // Одноразовый токен сброса пароля / magic link (исключён из выдачи).
  @Column({ type: DataType.STRING(64), allowNull: true, field: 'reset_token' })
  reset_token: string | null;

  @Column({
    type: DataType.DATE,
    allowNull: true,
    field: 'reset_token_expires',
  })
  reset_token_expires: Date | null;

  @Column({ type: DataType.STRING(64), allowNull: true, field: 'magic_token' })
  magic_token: string | null;

  @Column({
    type: DataType.DATE,
    allowNull: true,
    field: 'magic_token_expires',
  })
  magic_token_expires: Date | null;

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
