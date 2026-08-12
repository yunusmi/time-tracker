import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { ProjectsService } from './projects.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { Project } from './entities/project.entity';
import { ProjectWithStatsDto } from './dto/project-with-stats.dto';

@ApiTags('projects')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('projects')
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a project' })
  @ApiResponse({ status: 201, type: Project })
  create(
    @CurrentUser('id') userId: string,
    @Body() dto: CreateProjectDto,
  ): Promise<Project> {
    return this.projectsService.create(userId, dto);
  }

  @Get()
  @ApiOperation({
    summary: 'List projects with task counts and week tracked time',
  })
  @ApiQuery({
    name: 'include_archived',
    required: false,
    description: 'true — include archived projects',
  })
  @ApiResponse({ status: 200, type: [ProjectWithStatsDto] })
  findAll(
    @CurrentUser('id') userId: string,
    @Query('include_archived') includeArchived?: string,
  ): Promise<ProjectWithStatsDto[]> {
    return this.projectsService.findAll(userId, {
      includeArchived: includeArchived === 'true',
    });
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a project (name, color, archived)' })
  @ApiResponse({ status: 200, type: Project })
  update(
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateProjectDto,
  ): Promise<Project> {
    return this.projectsService.update(userId, id, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  @ApiOperation({
    summary: 'Delete a project (its tasks are kept without a project)',
  })
  @ApiResponse({ status: 204, description: 'Project deleted' })
  remove(
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    return this.projectsService.remove(userId, id);
  }
}
