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
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { TimeEntriesService } from './time-entries.service';
import { StartTimerDto } from './dto/start-timer.dto';
import { CreateManualEntryDto } from './dto/create-manual-entry.dto';
import { UpdateTimeEntryDto } from './dto/update-time-entry.dto';
import { TimeEntry } from './entities/time-entry.entity';

@ApiTags('time-entries')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('time-entries')
export class TimeEntriesController {
  constructor(private readonly timeEntriesService: TimeEntriesService) {}

  @Post('start')
  @ApiOperation({
    summary: 'Start a timer (stops any currently running timer first)',
  })
  @ApiResponse({ status: 201, type: TimeEntry })
  start(
    @CurrentUser('id') userId: string,
    @Body() dto: StartTimerDto,
  ): Promise<TimeEntry> {
    return this.timeEntriesService.start(userId, dto);
  }

  @Post('stop')
  @HttpCode(200)
  @ApiOperation({ summary: 'Stop the currently running timer' })
  @ApiResponse({ status: 200, type: TimeEntry })
  stop(@CurrentUser('id') userId: string): Promise<TimeEntry> {
    return this.timeEntriesService.stop(userId);
  }

  @Get('active')
  @ApiOperation({ summary: 'Get the currently running timer, if any' })
  @ApiOkResponse({ type: TimeEntry, description: 'Running entry or null' })
  getActive(@CurrentUser('id') userId: string): Promise<TimeEntry | null> {
    return this.timeEntriesService.getActive(userId);
  }

  @Post()
  @ApiOperation({ summary: 'Create a manual time entry' })
  @ApiResponse({ status: 201, type: TimeEntry })
  createManual(
    @CurrentUser('id') userId: string,
    @Body() dto: CreateManualEntryDto,
  ): Promise<TimeEntry> {
    return this.timeEntriesService.createManual(userId, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List time entries' })
  @ApiQuery({ name: 'date', required: false, example: '2026-05-21' })
  @ApiQuery({ name: 'task_id', required: false })
  @ApiResponse({ status: 200, type: [TimeEntry] })
  findAll(
    @CurrentUser('id') userId: string,
    @Query('date') date?: string,
    @Query('task_id') task_id?: string,
  ): Promise<TimeEntry[]> {
    return this.timeEntriesService.findAll(userId, { date, task_id });
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a time entry' })
  @ApiResponse({ status: 200, type: TimeEntry })
  update(
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateTimeEntryDto,
  ): Promise<TimeEntry> {
    return this.timeEntriesService.update(userId, id, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  @ApiOperation({ summary: 'Delete a time entry' })
  @ApiResponse({ status: 204, description: 'Entry deleted' })
  remove(
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    return this.timeEntriesService.remove(userId, id);
  }
}
