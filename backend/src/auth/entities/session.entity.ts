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
import { User } from '../../users/entities/user.entity';

/**
 * Активная сессия/устройство пользователя. JWT остаётся stateless, но
 * каждая сессия имеет jti: отозванные сессии отсекаются в JwtStrategy.
 */
@Table({ tableName: 'sessions', timestamps: true, updatedAt: false })
export class Session extends Model {
  @ApiProperty({ format: 'uuid' })
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column(DataType.UUID)
  id: string;

  @ApiProperty({ format: 'uuid' })
  @ForeignKey(() => User)
  @Column({ type: DataType.UUID, allowNull: false, field: 'user_id' })
  user_id: string;

  @ApiProperty({ example: 'Chrome · macOS' })
  @Default('Неизвестное устройство')
  @Column({ type: DataType.STRING, allowNull: false })
  device: string;

  @ApiProperty({ required: false, nullable: true, example: '85.140.0.1' })
  @Column({ type: DataType.STRING(64), allowNull: true })
  ip: string | null;

  @ApiProperty({ description: 'Последняя активность сессии' })
  @Default(DataType.NOW)
  @Column({ type: DataType.DATE, allowNull: false, field: 'last_seen' })
  last_seen: Date;

  @ApiProperty({ description: 'Отозвана ли сессия («Выйти»/«Выйти везде»)' })
  @Default(false)
  @Column({ type: DataType.BOOLEAN, allowNull: false })
  revoked: boolean;

  @ApiProperty()
  @CreatedAt
  @Column({ field: 'created_at' })
  created_at: Date;
}
