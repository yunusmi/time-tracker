import { ApiProperty } from '@nestjs/swagger';
import {
  BelongsTo,
  Column,
  DataType,
  Default,
  ForeignKey,
  Model,
  PrimaryKey,
  Table,
  Unique,
  UpdatedAt,
} from 'sequelize-typescript';
import { User } from './user.entity';

export enum ThemePreference {
  DARK = 'dark',
  LIGHT = 'light',
}

@Table({ tableName: 'user_settings', timestamps: true, createdAt: false })
export class UserSettings extends Model {
  @ApiProperty({ format: 'uuid' })
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column(DataType.UUID)
  id: string;

  @ApiProperty({ description: 'Цель дня, часов', example: 6 })
  @Default(6)
  @Column({ type: DataType.INTEGER, allowNull: false, field: 'daily_goal_hours' })
  daily_goal_hours: number;

  @ApiProperty({ description: 'Порог простоя, минут', example: 10 })
  @Default(10)
  @Column({
    type: DataType.INTEGER,
    allowNull: false,
    field: 'idle_threshold_minutes',
  })
  idle_threshold_minutes: number;

  @ApiProperty({ description: 'Напомнить начать трекинг в начале дня' })
  @Default(false)
  @Column({ type: DataType.BOOLEAN, allowNull: false, field: 'notify_day_start' })
  notify_day_start: boolean;

  @ApiProperty({ description: 'Сообщить, когда цель дня достигнута' })
  @Default(false)
  @Column({
    type: DataType.BOOLEAN,
    allowNull: false,
    field: 'notify_goal_reached',
  })
  notify_goal_reached: boolean;

  @ApiProperty({ enum: ThemePreference, example: ThemePreference.DARK })
  @Default(ThemePreference.DARK)
  @Column({
    type: DataType.ENUM(...Object.values(ThemePreference)),
    allowNull: false,
  })
  theme: ThemePreference;

  @ApiProperty({
    required: false,
    nullable: true,
    description:
      '«Не беспокоить» до этого момента (ставится на время фокус-сессии)',
  })
  @Column({ type: DataType.DATE, allowNull: true, field: 'dnd_until' })
  dnd_until: Date | null;

  @ApiProperty({
    description: 'Авто-стоп таймера в 19:00 при отсутствии активности',
    example: true,
  })
  @Default(false)
  @Column({
    type: DataType.BOOLEAN,
    allowNull: false,
    field: 'auto_stop_evening',
  })
  auto_stop_evening: boolean;

  @ApiProperty({
    description: 'Приветствие в стендап-отчёте',
    example: 'Всем привет!',
  })
  @Default('Всем привет!')
  @Column({ type: DataType.STRING, allowNull: false, field: 'standup_greeting' })
  standup_greeting: string;

  @ApiProperty({
    description: 'Строка «прочие активности» в стендап-отчёте',
    example: 'код-ревью и созвоны',
  })
  @Default('код-ревью и созвоны')
  @Column({
    type: DataType.STRING,
    allowNull: false,
    field: 'standup_misc_line',
  })
  standup_misc_line: string;

  @ApiProperty({ description: 'Подпись в стендап-отчёте', example: '' })
  @Default('')
  @Column({
    type: DataType.STRING,
    allowNull: false,
    field: 'standup_signature',
  })
  standup_signature: string;

  @ApiProperty({
    description: 'Авто-отправка стендапа в 10:00 (Slack/Telegram)',
    example: false,
  })
  @Default(false)
  @Column({
    type: DataType.BOOLEAN,
    allowNull: false,
    field: 'standup_auto_send',
  })
  standup_auto_send: boolean;

  @ApiProperty({ description: 'Лимит часов в месяц', example: 80 })
  @Default(80)
  @Column({
    type: DataType.INTEGER,
    allowNull: false,
    field: 'monthly_hours_limit',
  })
  monthly_hours_limit: number;

  @ApiProperty()
  @UpdatedAt
  @Column({ field: 'updated_at' })
  updated_at: Date;

  @ApiProperty({ format: 'uuid' })
  @ForeignKey(() => User)
  @Unique
  @Column({ type: DataType.UUID, allowNull: false, field: 'user_id' })
  user_id: string;

  @BelongsTo(() => User)
  user: User;
}
