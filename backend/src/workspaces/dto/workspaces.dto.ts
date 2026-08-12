import { ApiProperty } from '@nestjs/swagger';
import {
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { WorkspaceRole } from '../entities/workspace-member.entity';

export class CreateWorkspaceDto {
  @ApiProperty({ example: 'Команда Хронос' })
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  name: string;
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

export class WorkspaceMemberViewDto {
  @ApiProperty({ format: 'uuid' })
  user_id: string;

  @ApiProperty({ example: 'Аня Соколова' })
  name: string;

  @ApiProperty({ example: 'anya@example.com' })
  email: string;

  @ApiProperty({ enum: WorkspaceRole })
  role: WorkspaceRole;

  @ApiProperty({
    nullable: true,
    description: 'Название активной задачи/описание таймера (null — не трекает)',
  })
  active_task_title: string | null;

  @ApiProperty({ example: 15120 })
  today_seconds: number;

  @ApiProperty({ example: 77400 })
  week_seconds: number;
}

export class InviteLinkDto {
  @ApiProperty({ description: 'Токен приглашения по ссылке' })
  token: string;
}
