import { ApiProperty } from '@nestjs/swagger';
import {
  BelongsTo,
  Column,
  CreatedAt,
  DataType,
  Default,
  ForeignKey,
  Model,
  PrimaryKey,
  Table,
} from 'sequelize-typescript';
import { Workspace } from './workspace.entity';

/** Отдел внутри компании: фильтр в «Команде», привязка сотрудников. */
@Table({
  tableName: 'departments',
  timestamps: true,
  updatedAt: false,
  indexes: [{ unique: true, fields: ['workspace_id', 'name'] }],
})
export class Department extends Model {
  @ApiProperty({ format: 'uuid' })
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column(DataType.UUID)
  id: string;

  @ApiProperty({ format: 'uuid' })
  @ForeignKey(() => Workspace)
  @Column({ type: DataType.UUID, allowNull: false, field: 'workspace_id' })
  workspace_id: string;

  @BelongsTo(() => Workspace)
  workspace: Workspace;

  @ApiProperty({ example: 'Разработка' })
  @Column({ type: DataType.STRING, allowNull: false })
  name: string;

  @ApiProperty()
  @CreatedAt
  @Column({ field: 'created_at' })
  created_at: Date;
}
