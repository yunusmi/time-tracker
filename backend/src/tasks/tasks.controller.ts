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
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { TasksService } from './tasks.service';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { Task } from './entities/task.entity';
import { TaskWithStatsDto } from './dto/task-with-stats.dto';

@ApiTags('tasks')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('tasks')
export class TasksController {
  constructor(private readonly tasksService: TasksService) {}

  @Post()
  @ApiOperation({ summary: 'Create a task' })
  @ApiResponse({ status: 201, type: Task })
  create(
    @CurrentUser('id') userId: string,
    @Body() dto: CreateTaskDto,
  ): Promise<Task> {
    return this.tasksService.create(userId, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List all tasks with tracked time and pomodoro stats' })
  @ApiResponse({ status: 200, type: [TaskWithStatsDto] })
  findAll(@CurrentUser('id') userId: string): Promise<TaskWithStatsDto[]> {
    return this.tasksService.findAll(userId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single task' })
  @ApiResponse({ status: 200, type: Task })
  findOne(
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<Task> {
    return this.tasksService.findOne(userId, id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a task' })
  @ApiResponse({ status: 200, type: Task })
  update(
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateTaskDto,
  ): Promise<Task> {
    return this.tasksService.update(userId, id, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  @ApiOperation({ summary: 'Delete a task' })
  @ApiResponse({ status: 204, description: 'Task deleted' })
  remove(
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    return this.tasksService.remove(userId, id);
  }
}
