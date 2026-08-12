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
import { User } from '../../users/entities/user.entity';

@Table({ tableName: 'pomodoro_settings', timestamps: true, createdAt: false })
export class PomodoroSettings extends Model {
  @ApiProperty({ format: 'uuid' })
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column(DataType.UUID)
  id: string;

  @ApiProperty({ description: 'Work interval length in minutes', example: 25 })
  @Default(25)
  @Column({ type: DataType.INTEGER, allowNull: false, field: 'work_minutes' })
  work_minutes: number;

  @ApiProperty({ description: 'Short break length in minutes', example: 5 })
  @Default(5)
  @Column({
    type: DataType.INTEGER,
    allowNull: false,
    field: 'short_break_minutes',
  })
  short_break_minutes: number;

  @ApiProperty({ description: 'Long break length in minutes', example: 15 })
  @Default(15)
  @Column({
    type: DataType.INTEGER,
    allowNull: false,
    field: 'long_break_minutes',
  })
  long_break_minutes: number;

  @ApiProperty({
    description: 'Number of work intervals before a long break',
    example: 4,
  })
  @Default(4)
  @Column({
    type: DataType.INTEGER,
    allowNull: false,
    field: 'long_break_interval',
  })
  long_break_interval: number;

  @ApiProperty({ description: 'Auto-start the next interval', example: false })
  @Default(false)
  @Column({ type: DataType.BOOLEAN, allowNull: false, field: 'auto_start' })
  auto_start: boolean;

  @ApiProperty({
    description:
      'Записывать завершённые фокус-сессии в трекер времени (time-entry создаёт клиент)',
    example: true,
  })
  @Default(true)
  @Column({ type: DataType.BOOLEAN, allowNull: false, field: 'track_to_timer' })
  track_to_timer: boolean;

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
