import { Injectable } from '@nestjs/common';
import { Workbook, Worksheet } from 'exceljs';
import { TasksService } from '../tasks/tasks.service';
import { TimeEntriesService } from '../time-entries/time-entries.service';
import { PomodoroService } from '../pomodoro/pomodoro.service';
import { TaskWithStatsDto } from '../tasks/dto/task-with-stats.dto';
import { TimeEntry } from '../time-entries/entities/time-entry.entity';

@Injectable()
export class ExportService {
  constructor(
    private readonly tasksService: TasksService,
    private readonly timeEntriesService: TimeEntriesService,
    private readonly pomodoroService: PomodoroService,
  ) {}

  /** Builds an .xlsx daily report for the given (UTC) day, default today. */
  async buildDailyReport(
    userId: string,
    date?: string,
  ): Promise<{ buffer: Buffer; filename: string }> {
    const range = TimeEntriesService.dayRange(date);
    const isoDate = range.start.toISOString().slice(0, 10);

    const [completedTasks, entries, pomodoroStats] = await Promise.all([
      this.tasksService.findCompletedForDay(userId, range),
      this.timeEntriesService.findForDay(userId, date),
      this.pomodoroService.getStats(userId, date),
    ]);

    const workbook = new Workbook();
    workbook.creator = 'Time Tracker';
    workbook.created = new Date();

    this.addCompletedTasksSheet(workbook, completedTasks, isoDate);
    this.addTimeEntriesSheet(workbook, entries);
    this.addSummarySheet(
      workbook,
      isoDate,
      completedTasks,
      entries,
      pomodoroStats,
    );

    const arrayBuffer = await workbook.xlsx.writeBuffer();
    return {
      buffer: Buffer.from(arrayBuffer),
      filename: `time-report-${isoDate}.xlsx`,
    };
  }

  private addCompletedTasksSheet(
    workbook: Workbook,
    tasks: TaskWithStatsDto[],
    isoDate: string,
  ): void {
    const sheet = workbook.addWorksheet('Completed Tasks');
    sheet.columns = [
      { header: '#', key: 'index', width: 5 },
      { header: 'Task', key: 'title', width: 40 },
      { header: 'Description', key: 'description', width: 45 },
      { header: 'Estimated (min)', key: 'estimated', width: 16 },
      { header: 'Tracked time', key: 'tracked', width: 16 },
      { header: 'Pomodoros', key: 'pomodoros', width: 12 },
      { header: 'Completed at', key: 'completed_at', width: 22 },
    ];
    this.styleHeader(sheet);

    tasks.forEach((task, i) => {
      sheet.addRow({
        index: i + 1,
        title: task.title,
        description: task.description ?? '',
        estimated: task.estimated_minutes ?? '',
        tracked: ExportService.formatDuration(task.total_tracked_seconds),
        pomodoros: task.pomodoro_count,
        completed_at: task.completed_at
          ? ExportService.formatDateTime(task.completed_at)
          : '',
      });
    });

    if (tasks.length === 0) {
      sheet.addRow({ title: `No tasks completed on ${isoDate}` });
    }
  }

  private addTimeEntriesSheet(workbook: Workbook, entries: TimeEntry[]): void {
    const sheet = workbook.addWorksheet('Time Entries');
    sheet.columns = [
      { header: '#', key: 'index', width: 5 },
      { header: 'Task', key: 'task', width: 40 },
      { header: 'Description', key: 'description', width: 40 },
      { header: 'From', key: 'started_at', width: 22 },
      { header: 'To', key: 'ended_at', width: 22 },
      { header: 'Duration', key: 'duration', width: 14 },
      { header: 'Type', key: 'type', width: 12 },
    ];
    this.styleHeader(sheet);

    entries.forEach((entry, i) => {
      sheet.addRow({
        index: i + 1,
        task: entry.task?.title ?? '—',
        description: entry.description ?? '',
        started_at: ExportService.formatDateTime(entry.started_at),
        ended_at: entry.ended_at
          ? ExportService.formatDateTime(entry.ended_at)
          : 'running',
        duration: ExportService.formatDuration(entry.duration_seconds),
        type: entry.is_manual ? 'manual' : 'timer',
      });
    });

    if (entries.length === 0) {
      sheet.addRow({ task: 'No time entries for this day' });
    }
  }

  private addSummarySheet(
    workbook: Workbook,
    isoDate: string,
    tasks: TaskWithStatsDto[],
    entries: TimeEntry[],
    pomodoroStats: {
      completed_work_sessions: number;
      total_focus_seconds: number;
    },
  ): void {
    const sheet = workbook.addWorksheet('Summary');
    sheet.columns = [
      { header: 'Metric', key: 'metric', width: 32 },
      { header: 'Value', key: 'value', width: 24 },
    ];
    this.styleHeader(sheet);

    const totalTracked = entries.reduce(
      (sum, e) => sum + e.duration_seconds,
      0,
    );

    const rows: Array<[string, string | number]> = [
      ['Date', isoDate],
      ['Completed tasks', tasks.length],
      ['Total tracked time', ExportService.formatDuration(totalTracked)],
      ['Time entries', entries.length],
      ['Completed pomodoros', pomodoroStats.completed_work_sessions],
      [
        'Pomodoro focus time',
        ExportService.formatDuration(pomodoroStats.total_focus_seconds),
      ],
    ];
    rows.forEach(([metric, value]) => sheet.addRow({ metric, value }));

    // Разбивка затреканного времени по проектам.
    const byProject = new Map<string, number>();
    for (const entry of entries) {
      const name = entry.task?.project?.name ?? 'No project';
      byProject.set(name, (byProject.get(name) ?? 0) + entry.duration_seconds);
    }
    if (byProject.size > 0) {
      sheet.addRow({});
      const header = sheet.addRow({ metric: 'By project', value: '' });
      header.font = { bold: true };
      [...byProject.entries()]
        .sort((a, b) => b[1] - a[1])
        .forEach(([name, seconds]) =>
          sheet.addRow({
            metric: name,
            value: ExportService.formatDuration(seconds),
          }),
        );
    }
  }

  private styleHeader(sheet: Worksheet): void {
    const header = sheet.getRow(1);
    header.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    header.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF4F46E5' },
    };
    header.alignment = { vertical: 'middle' };
  }

  static formatDuration(totalSeconds: number): string {
    const seconds = Math.max(0, Math.round(totalSeconds));
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    const pad = (n: number) => n.toString().padStart(2, '0');
    return `${pad(h)}:${pad(m)}:${pad(s)}`;
  }

  static formatDateTime(date: Date): string {
    return new Date(date).toISOString().replace('T', ' ').slice(0, 19);
  }
}
