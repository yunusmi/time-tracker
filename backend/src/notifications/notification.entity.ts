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

  @ApiProperty({ example: false })
  @Default(false)
  @Column({ type: DataType.BOOLEAN, allowNull: false })
  read: boolean;

  @ApiProperty()
  @CreatedAt
  @Column({ field: 'created_at' })
  created_at: Date;
}
