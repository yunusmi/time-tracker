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
import { Workspace } from './workspace.entity';

export enum AbsenceKind {
  VACATION = 'vacation',
  SICK = 'sick',
}

/**
 * Отсутствие сотрудника: за эти дни норма не начисляется и человек
 * не попадает в «недобор» (ТЗ «Отсутствия с датами»).
 */
@Table({ tableName: 'absences', timestamps: true, updatedAt: false })
export class Absence extends Model {
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

  @BelongsTo(() => User)
  user: User;

  @ApiProperty({ example: '2026-08-17', description: 'Дата начала (включительно)' })
  @Column({ type: DataType.DATEONLY, allowNull: false, field: 'date_from' })
  date_from: string;

  @ApiProperty({ example: '2026-08-24', description: 'Дата конца (включительно)' })
  @Column({ type: DataType.DATEONLY, allowNull: false, field: 'date_to' })
  date_to: string;

  @ApiProperty({ enum: AbsenceKind, example: AbsenceKind.VACATION })
  @Default(AbsenceKind.VACATION)
  @Column({
    type: DataType.ENUM(...Object.values(AbsenceKind)),
    allowNull: false,
  })
  kind: AbsenceKind;

  @ApiProperty()
  @CreatedAt
  @Column({ field: 'created_at' })
  created_at: Date;
}
