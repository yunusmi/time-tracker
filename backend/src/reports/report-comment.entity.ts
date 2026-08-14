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
import { User } from '../users/entities/user.entity';
import { Project } from '../projects/entities/project.entity';

/** Тред «вопросы по отчёту»: клиент ↔ менеджер по проекту. */
@Table({ tableName: 'report_comments', timestamps: true, updatedAt: false })
export class ReportComment extends Model {
  @ApiProperty({ format: 'uuid' })
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column(DataType.UUID)
  id: string;

  @ApiProperty({ format: 'uuid' })
  @ForeignKey(() => Project)
  @Column({ type: DataType.UUID, allowNull: false, field: 'project_id' })
  project_id: string;

  @ApiProperty({ format: 'uuid' })
  @ForeignKey(() => User)
  @Column({ type: DataType.UUID, allowNull: false, field: 'author_id' })
  author_id: string;

  @BelongsTo(() => User)
  author: User;

  @ApiProperty({ example: 'Почему в среду меньше часов?' })
  @Column({ type: DataType.TEXT, allowNull: false })
  body: string;

  @ApiProperty()
  @CreatedAt
  @Column({ field: 'created_at' })
  created_at: Date;
}
