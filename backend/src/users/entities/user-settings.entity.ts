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
