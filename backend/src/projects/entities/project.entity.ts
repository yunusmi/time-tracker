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
import { Task } from '../../tasks/entities/task.entity';

/** Палитра проектов из дизайна. */
export const PROJECT_COLORS = [
  '#60a5fa',
  '#f472b6',
  '#fbbf24',
  '#34d399',
  '#a78bfa',
  '#f87171',
] as const;

@Table({ tableName: 'projects', timestamps: true })
export class Project extends Model {
  @ApiProperty({ format: 'uuid' })
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column(DataType.UUID)
  id: string;

  @ApiProperty({ example: 'Разработка' })
  @Column({ type: DataType.STRING, allowNull: false })
  name: string;

  @ApiProperty({ example: '#60a5fa', description: 'Hex-цвет проекта' })
  @Default(PROJECT_COLORS[0])
  @Column({ type: DataType.STRING(9), allowNull: false })
  color: string;

  @ApiProperty({
    description:
      'Архивный проект скрыт из списков; записи времени остаются в отчётах',
    example: false,
  })
  @Default(false)
  @Column({ type: DataType.BOOLEAN, allowNull: false })
  archived: boolean;

  @ApiProperty({ description: 'Часовая ставка, ₽/ч', example: 2500 })
  @Default(0)
  @Column({ type: DataType.FLOAT, allowNull: false, field: 'hourly_rate' })
  hourly_rate: number;

  @ApiProperty({
    description: 'Недельный бюджет часов (0 — не задан)',
    example: 20,
  })
  @Default(0)
  @Column({
    type: DataType.INTEGER,
    allowNull: false,
    field: 'weekly_budget_hours',
  })
  weekly_budget_hours: number;

  @ApiProperty()
  @CreatedAt
  @Column({ field: 'created_at' })
  created_at: Date;

  @ApiProperty()
  @UpdatedAt
  @Column({ field: 'updated_at' })
  updated_at: Date;

  @ApiProperty({
    required: false,
    nullable: true,
    format: 'uuid',
    description: 'Компания (workspace) — изоляция данных мультитенантности',
  })
  @Column({ type: DataType.UUID, allowNull: true, field: 'workspace_id' })
  workspace_id: string | null;

  @ApiProperty({ format: 'uuid' })
  @ForeignKey(() => User)
  @Column({ type: DataType.UUID, allowNull: false, field: 'user_id' })
  user_id: string;

  @BelongsTo(() => User)
  user: User;

  @HasMany(() => Task)
  tasks: Task[];
}
