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
  Unique,
  UpdatedAt,
} from 'sequelize-typescript';
import { User } from '../users/entities/user.entity';
import { Workspace } from '../workspaces/entities/workspace.entity';
import { Project } from '../projects/entities/project.entity';

@Table({ tableName: 'report_shares', timestamps: true })
export class ReportShare extends Model {
  @ApiProperty({ format: 'uuid' })
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column(DataType.UUID)
  id: string;

  @ApiProperty({ format: 'uuid' })
  @ForeignKey(() => Workspace)
  @Column({ type: DataType.UUID, allowNull: false, field: 'workspace_id' })
  workspace_id: string;

  @ApiProperty({ format: 'uuid' })
  @ForeignKey(() => User)
  @Column({ type: DataType.UUID, allowNull: false, field: 'user_id' })
  user_id: string;

  @ApiProperty({ format: 'uuid', nullable: true, description: 'null — все проекты' })
  @ForeignKey(() => Project)
  @Column({ type: DataType.UUID, allowNull: true, field: 'project_id' })
  project_id: string | null;

  @ApiProperty()
  @Unique
  @Column({ type: DataType.STRING(64), allowNull: false })
  token: string;

  @ApiProperty({ example: false })
  @Default(false)
  @Column({ type: DataType.BOOLEAN, allowNull: false, field: 'hide_money' })
  hide_money: boolean;

  @ApiProperty({ example: false })
  @Default(false)
  @Column({ type: DataType.BOOLEAN, allowNull: false, field: 'hide_names' })
  hide_names: boolean;

  @ApiProperty({ example: true })
  @Default(true)
  @Column({ type: DataType.BOOLEAN, allowNull: false })
  active: boolean;

  @ApiProperty()
  @CreatedAt
  @Column({ field: 'created_at' })
  created_at: Date;

  @ApiProperty()
  @UpdatedAt
  @Column({ field: 'updated_at' })
  updated_at: Date;
}
