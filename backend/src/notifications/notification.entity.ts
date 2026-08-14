import { ApiProperty } from '@nestjs/swagger';
import {
  Column,
  CreatedAt,
  DataType,
  Default,
  ForeignKey,
  Model,
  PrimaryKey,
  Table,
} from 'sequelize-typescript';
import { User } from '../users/entities/user.entity';

export type NotificationDot = 'accent' | 'green' | 'red' | 'amber';

/** Тип уведомления — для фильтров экрана «Уведомления». */
export type NotificationKind =
  | 'task'
  | 'timesheet'
  | 'standup'
  | 'digest'
  | 'system';

@Table({ tableName: 'notifications', timestamps: true, updatedAt: false })
export class AppNotification extends Model {
  @ApiProperty({ format: 'uuid' })
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column(DataType.UUID)
  id: string;

  @ApiProperty({ format: 'uuid' })
  @ForeignKey(() => User)
  @Column({ type: DataType.UUID, allowNull: false, field: 'user_id' })
  user_id: string;

  @ApiProperty({ example: 'Новая задача от админа: «Фикс бага»' })
  @Column({ type: DataType.TEXT, allowNull: false })
  text: string;

  @ApiProperty({ example: 'accent', description: 'Цвет точки в списке' })
  @Default('accent')
  @Column({ type: DataType.STRING(12), allowNull: false })
  dot: NotificationDot;

  @ApiProperty({
    example: 'task',
    description: 'Тип: task / timesheet / standup / digest / system',
  })
  @Default('system')
  @Column({ type: DataType.STRING(16), allowNull: false })
  kind: NotificationKind;

  @ApiProperty({
    required: false,
    nullable: true,
    example: 'timesheets',
    description: 'Экран для кнопки действия (сегмент пути в /dashboard)',
  })
  @Column({ type: DataType.STRING(32), allowNull: true, field: 'action_screen' })
  action_screen: string | null;

  @ApiProperty({
    required: false,
    nullable: true,
    description: 'Каналы, в которые ушло уведомление (email/push/app)',
  })
  @Default([])
  @Column({ type: DataType.JSONB, allowNull: false })
  channels: string[];

  @ApiProperty({ example: false })
  @Default(false)
  @Column({ type: DataType.BOOLEAN, allowNull: false })
  read: boolean;

  @ApiProperty()
  @CreatedAt
  @Column({ field: 'created_at' })
  created_at: Date;
}
