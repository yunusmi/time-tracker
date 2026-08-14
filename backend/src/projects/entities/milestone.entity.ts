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
  UpdatedAt,
} from 'sequelize-typescript';
import { Project } from './project.entity';

export enum MilestoneStatus {
  PLAN = 'plan',
  IN_PROGRESS = 'in_progress',
  DONE = 'done',
}

/** Веха проекта: задаёт менеджер, видит клиент в своём дашборде. */
@Table({ tableName: 'milestones', timestamps: true })
export class Milestone extends Model {
  @ApiProperty({ format: 'uuid' })
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column(DataType.UUID)
  id: string;

  @ApiProperty({ format: 'uuid' })
  @ForeignKey(() => Project)
  @Column({ type: DataType.UUID, allowNull: false, field: 'project_id' })
  project_id: string;

  @BelongsTo(() => Project)
  project: Project;

  @ApiProperty({ example: 'Бета-версия' })
  @Column({ type: DataType.STRING, allowNull: false })
  title: string;

  @ApiProperty({ required: false, nullable: true, example: '2026-09-01' })
  @Column({ type: DataType.DATEONLY, allowNull: true, field: 'due_date' })
  due_date: string | null;

  @ApiProperty({ enum: MilestoneStatus, example: MilestoneStatus.PLAN })
  @Default(MilestoneStatus.PLAN)
  @Column({
    type: DataType.ENUM(...Object.values(MilestoneStatus)),
    allowNull: false,
  })
  status: MilestoneStatus;

  @ApiProperty()
  @CreatedAt
  @Column({ field: 'created_at' })
  created_at: Date;

  @ApiProperty()
  @UpdatedAt
  @Column({ field: 'updated_at' })
  updated_at: Date;
}
