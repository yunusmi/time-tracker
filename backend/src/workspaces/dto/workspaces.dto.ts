import { ApiProperty } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEmail,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { PayKind, WorkspaceRole } from '../entities/workspace-member.entity';
import { WorkspaceCurrency } from '../entities/workspace.entity';
import { AbsenceKind } from '../entities/absence.entity';

export class CreateWorkspaceDto {
  @ApiProperty({ example: 'Команда Хронос' })
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  name: string;

  @ApiProperty({
    required: false,
    type: [String],
    description: 'Отделы мастера создания компании',
    example: ['Разработка', 'Дизайн'],
  })
  @IsOptional()
  departments?: string[];

  @ApiProperty({
    required: false,
    type: [String],
    description: 'Bulk-приглашения (email) из мастера',
  })
  @IsOptional()
  invites?: string[];
}

export class UpdateWorkspaceDto {
  @ApiProperty({ required: false, example: 'Команда Хронос' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  name?: string;

  @ApiProperty({ required: false, enum: WorkspaceCurrency })
  @IsOptional()
  @IsEnum(WorkspaceCurrency)
  currency?: WorkspaceCurrency;

  @ApiProperty({ required: false, example: '#6366f1' })
  @IsOptional()
  @Matches(/^#[0-9a-fA-F]{6}$/)
  brand_color?: string;

  @ApiProperty({
    required: false,
    nullable: true,
    description: 'Логотип: data-URL (PNG/SVG, квадрат от 128px) или null',
  })
  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsString()
  @MaxLength(700_000)
  logo_url?: string | null;

  @ApiProperty({ required: false, minimum: 1, maximum: 24, example: 8 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(24)
  day_norm_hours?: number;

  @ApiProperty({
    required: false,
    description: 'Округление в отчётах/счетах: 0, 15 или 30 минут',
    example: 15,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(60)
  rounding_minutes?: number;
}

export class UpdateMemberDto {
  @ApiProperty({ required: false, nullable: true, format: 'uuid' })
  @IsOptional()
  department_id?: string | null;

  @ApiProperty({ required: false, enum: PayKind })
  @IsOptional()
  @IsEnum(PayKind)
  pay_kind?: PayKind;

  @ApiProperty({
    required: false,
    description: 'Ставка ₽/ч или оклад ₽/мес в валюте компании',
    example: 2500,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  pay_rate?: number;
}

export class CreateDepartmentDto {
  @ApiProperty({ example: 'Разработка' })
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name: string;
}

export class CreateAbsenceDto {
  @ApiProperty({ format: 'uuid' })
  @IsString()
  user_id: string;

  @ApiProperty({ example: '2026-08-17' })
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  date_from: string;

  @ApiProperty({ example: '2026-08-24' })
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  date_to: string;

  @ApiProperty({ enum: AbsenceKind, default: AbsenceKind.VACATION })
  @IsOptional()
  @IsEnum(AbsenceKind)
  kind?: AbsenceKind;
}

export class SwitchWorkspaceDto {
  @ApiProperty({ format: 'uuid' })
  @IsString()
  workspace_id: string;
}

export class BulkInviteDto {
  @ApiProperty({ type: [String], example: ['a@b.com', 'c@d.com'] })
  emails: string[];

  @ApiProperty({ required: false, enum: WorkspaceRole })
  @IsOptional()
  @IsEnum(WorkspaceRole)
  role?: WorkspaceRole;

  @ApiProperty({ required: false, description: 'Не слать письма (тихий импорт)' })
  @IsOptional()
  @IsBoolean()
  silent?: boolean;
}

export class CreateInviteDto {
  @ApiProperty({ example: 'colleague@example.com' })
  @IsEmail()
  email: string;

  @ApiProperty({
    required: false,
    enum: [WorkspaceRole.ADMIN, WorkspaceRole.MEMBER],
    default: WorkspaceRole.MEMBER,
  })
  @IsOptional()
  @IsEnum(WorkspaceRole)
  role?: WorkspaceRole;
}

export class ChangeRoleDto {
  @ApiProperty({
    enum: [
      WorkspaceRole.ADMIN,
      WorkspaceRole.PM,
      WorkspaceRole.MEMBER,
      WorkspaceRole.CLIENT,
    ],
  })
  @IsEnum(WorkspaceRole)
  role: WorkspaceRole;

  @ApiProperty({
    required: false,
    nullable: true,
    format: 'uuid',
    description: 'Проект для ролей pm/client',
  })
  @IsOptional()
  project_id?: string | null;
}

export class WorkspaceMemberViewDto {
  @ApiProperty({ format: 'uuid' })
  user_id: string;

  @ApiProperty({ example: 'Аня Соколова' })
  name: string;

  @ApiProperty({ example: 'anya@example.com' })
  email: string;

  @ApiProperty({ nullable: true, description: 'Аватар (data-URL) или null' })
  avatar_url: string | null;

  @ApiProperty({ enum: WorkspaceRole })
  role: WorkspaceRole;

  @ApiProperty({ nullable: true, format: 'uuid' })
  department_id: string | null;

  @ApiProperty({ nullable: true, example: 'Разработка' })
  department_name: string | null;

  @ApiProperty({
    nullable: true,
    description: 'Название активной задачи/описание таймера (null — не трекает)',
  })
  active_task_title: string | null;

  @ApiProperty({ description: '«Не беспокоить» — идёт фокус-сессия' })
  dnd: boolean;

  @ApiProperty({
    nullable: true,
    enum: AbsenceKind,
    description: 'Текущее отсутствие (отпуск/больничный) или null',
  })
  absence_kind: AbsenceKind | null;

  @ApiProperty({ nullable: true, example: '2026-08-18' })
  absence_until: string | null;

  @ApiProperty({ nullable: true, enum: PayKind, description: 'Только admin+' })
  pay_kind: PayKind | null;

  @ApiProperty({ nullable: true, description: 'Только admin+' })
  pay_rate: number | null;

  @ApiProperty({
    nullable: true,
    description: 'Ставка в час (оклад пересчитан по норме); только admin+',
  })
  hourly_rate: number | null;

  @ApiProperty({ example: 15120 })
  today_seconds: number;

  @ApiProperty({ example: 77400 })
  week_seconds: number;
}

export class InviteLinkDto {
  @ApiProperty({ description: 'Токен приглашения по ссылке' })
  token: string;
}
