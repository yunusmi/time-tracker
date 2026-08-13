import {
  Body,
  Controller,
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
  ApiProperty,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { TimesheetsService } from './timesheets.service';
import { Timesheet } from './entities/timesheet.entity';

class SubmitTimesheetDto {
  @ApiProperty({
    required: false,
    example: '2026-08-10',
    description: 'Любая дата недели; по умолчанию — текущая неделя',
  })
  @IsOptional()
  @IsString()
  week?: string;
}

class ReviewTimesheetDto {
  @ApiProperty({ enum: ['approve', 'return'] })
  @IsIn(['approve', 'return'])
  action: 'approve' | 'return';

  @ApiProperty({ required: false, description: 'Комментарий при возврате' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  comment?: string;
}

@ApiTags('timesheets')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('timesheets')
export class TimesheetsController {
  constructor(private readonly timesheetsService: TimesheetsService) {}

  @Get()
  @ApiOperation({
    summary: 'Мой таймшит недели + (admin) таймшиты команды',
  })
  @ApiQuery({ name: 'week', required: false, example: '2026-08-10' })
  list(@CurrentUser('id') userId: string, @Query('week') week?: string) {
    return this.timesheetsService.list(userId, week);
  }

  @Post('submit')
  @HttpCode(200)
  @ApiOperation({ summary: 'Отправить неделю на проверку' })
  submit(
    @CurrentUser('id') userId: string,
    @Body() dto: SubmitTimesheetDto,
  ): Promise<Timesheet> {
    return this.timesheetsService.submit(userId, dto.week);
  }

  @Post('approve-all')
  @HttpCode(200)
  @ApiOperation({ summary: 'Утвердить все pending за неделю (admin+)' })
  approveAll(
    @CurrentUser('id') userId: string,
    @Body() dto: SubmitTimesheetDto,
  ): Promise<{ approved: number }> {
    return this.timesheetsService.approveAll(userId, dto.week);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Утвердить / вернуть таймшит (admin+)' })
  review(
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReviewTimesheetDto,
  ): Promise<Timesheet> {
    return this.timesheetsService.review(userId, id, dto.action, dto.comment);
  }
}
