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

/** Подписка браузера на Web Push (VAPID). */
@Table({
  tableName: 'push_subscriptions',
  timestamps: true,
  updatedAt: false,
  indexes: [{ unique: true, fields: ['endpoint'] }],
})
export class PushSubscription extends Model {
  @ApiProperty({ format: 'uuid' })
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column(DataType.UUID)
  id: string;

  @ApiProperty({ format: 'uuid' })
  @ForeignKey(() => User)
  @Column({ type: DataType.UUID, allowNull: false, field: 'user_id' })
  user_id: string;

  @ApiProperty({ description: 'URL эндпоинта push-сервиса браузера' })
  @Column({ type: DataType.TEXT, allowNull: false })
  endpoint: string;

  @ApiProperty({ description: 'Ключи подписки (p256dh, auth)' })
  @Column({ type: DataType.JSONB, allowNull: false })
  keys: { p256dh: string; auth: string };

  @ApiProperty()
  @CreatedAt
  @Column({ field: 'created_at' })
  created_at: Date;
}
