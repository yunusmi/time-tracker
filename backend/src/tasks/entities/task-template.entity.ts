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
import { User } from '../../users/entities/user.entity';
import { Project } from '../../projects/entities/project.entity';

@Table({ tableName: 'task_templates', timestamps: true, updatedAt: false })
export class TaskTemplate extends Model {
  @ApiProperty({ format: 'uuid' })
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column(DataType.UUID)
  id: string;

  @ApiProperty({ format: 'uuid' })
  @ForeignKey(() => User)
  @Column({ type: DataType.UUID, allowNull: false, field: 'user_id' })
  user_id: string;

  @ApiProperty({ example: 'Дейли-стендап' })
  @Column({ type: DataType.STRING, allowNull: false })
  title: string;

  @ApiProperty({ required: false, nullable: true, format: 'uuid' })
  @ForeignKey(() => Project)
  @Column({ type: DataType.UUID, allowNull: true, field: 'project_id' })
  project_id: string | null;

  @BelongsTo(() => Project)
  project: Project | null;

  @ApiProperty({ required: false, nullable: true, example: 15 })
  @Column({
    type: DataType.INTEGER,
    allowNull: true,
    field: 'estimated_minutes',
  })
  estimated_minutes: number | null;

  @ApiProperty()
  @CreatedAt
  @Column({ field: 'created_at' })
  created_at: Date;
}
