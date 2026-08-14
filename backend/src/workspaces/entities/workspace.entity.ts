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
import { WorkspaceMember } from './workspace-member.entity';
import { WorkspaceInvite } from './workspace-invite.entity';

/** Валюты компании (ТЗ «Валюта и точность»): символ применяется во всех суммах. */
export enum WorkspaceCurrency {
  RUB = 'RUB',
  USD = 'USD',
  EUR = 'EUR',
  KZT = 'KZT',
  UZS = 'UZS',
}

/** Палитра цвета компании (совпадает с палитрой проектов из дизайна). */
export const BRAND_COLORS = [
  '#6366f1',
  '#60a5fa',
  '#f472b6',
  '#fbbf24',
  '#34d399',
  '#a78bfa',
] as const;

@Table({ tableName: 'workspaces', timestamps: true })
export class Workspace extends Model {
  @ApiProperty({ format: 'uuid' })
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column(DataType.UUID)
  id: string;

  @ApiProperty({ example: 'Команда Хронос' })
  @Column({ type: DataType.STRING, allowNull: false })
  name: string;

  @ApiProperty({
    enum: WorkspaceCurrency,
    example: WorkspaceCurrency.RUB,
    description: 'Валюта компании: символ и формат применяются во всех суммах',
  })
  @Default(WorkspaceCurrency.RUB)
  @Column({
    type: DataType.ENUM(...Object.values(WorkspaceCurrency)),
    allowNull: false,
  })
  currency: WorkspaceCurrency;

  @ApiProperty({
    example: '#6366f1',
    description: 'Цвет компании в переключателе и письмах',
  })
  @Default(BRAND_COLORS[0])
  @Column({ type: DataType.STRING(9), allowNull: false, field: 'brand_color' })
  brand_color: string;

  @ApiProperty({
    required: false,
    nullable: true,
    description: 'Логотип компании (data-URL или путь), квадрат от 128px',
  })
  @Column({ type: DataType.TEXT, allowNull: true, field: 'logo_url' })
  logo_url: string | null;

  @ApiProperty({
    description: 'Норма часов в день для расчёта недобора и оклада',
    example: 8,
  })
  @Default(8)
  @Column({ type: DataType.INTEGER, allowNull: false, field: 'day_norm_hours' })
  day_norm_hours: number;

  @ApiProperty({
    description: 'Округление времени в клиентских отчётах и счетах, мин (0 — нет)',
    example: 0,
  })
  @Default(0)
  @Column({
    type: DataType.INTEGER,
    allowNull: false,
    field: 'rounding_minutes',
  })
  rounding_minutes: number;

  @ApiProperty({ format: 'uuid' })
  @ForeignKey(() => User)
  @Column({ type: DataType.UUID, allowNull: false, field: 'owner_id' })
  owner_id: string;

  @BelongsTo(() => User)
  owner: User;

  @ApiProperty()
  @CreatedAt
  @Column({ field: 'created_at' })
  created_at: Date;

  @ApiProperty()
  @UpdatedAt
  @Column({ field: 'updated_at' })
  updated_at: Date;

  @HasMany(() => WorkspaceMember)
  members: WorkspaceMember[];

  @HasMany(() => WorkspaceInvite)
  invites: WorkspaceInvite[];
}
