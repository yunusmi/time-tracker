import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiProperty,
  ApiTags,
} from '@nestjs/swagger';
import {
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { InjectModel } from '@nestjs/sequelize';
import { NotFoundException } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { TaskTemplate } from './entities/task-template.entity';
import { Project } from '../projects/entities/project.entity';

class CreateTemplateDto {
  @ApiProperty({ example: 'Дейли-стендап' })
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  title: string;

  @ApiProperty({ required: false, nullable: true, format: 'uuid' })
  @IsOptional()
  @IsUUID()
  project_id?: string | null;

  @ApiProperty({ required: false, nullable: true, example: 15 })
  @IsOptional()
  @IsInt()
  @Min(0)
  estimated_minutes?: number | null;
}

@ApiTags('task-templates')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('task-templates')
export class TaskTemplatesController {
  constructor(
    @InjectModel(TaskTemplate)
    private readonly templateModel: typeof TaskTemplate,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Шаблоны задач пользователя' })
  list(@CurrentUser('id') userId: string): Promise<TaskTemplate[]> {
    return this.templateModel.findAll({
      where: { user_id: userId },
      include: [Project],
      order: [['created_at', 'ASC']],
    });
  }

  @Post()
  @ApiOperation({ summary: 'Сохранить шаблон задачи' })
  create(
    @CurrentUser('id') userId: string,
    @Body() dto: CreateTemplateDto,
  ): Promise<TaskTemplate> {
    return this.templateModel.create({
      user_id: userId,
      title: dto.title,
      project_id: dto.project_id ?? null,
      estimated_minutes: dto.estimated_minutes ?? null,
    });
  }

  @Delete(':id')
  @HttpCode(204)
  @ApiOperation({ summary: 'Удалить шаблон' })
  async remove(
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    const tpl = await this.templateModel.findOne({
      where: { id, user_id: userId },
    });
    if (!tpl) throw new NotFoundException('Шаблон не найден');
    await tpl.destroy();
  }
}
