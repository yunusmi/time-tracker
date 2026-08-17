/**
 * Импорт записей времени из CSV-экспорта Toggl Track / Clockify / Harvest.
 * Все три сервиса отдают CSV с колонками проекта, задачи и интервала —
 * различаются только заголовки, поэтому разбор общий с маппингом синонимов.
 */

export interface ImportedRow {
  project: string | null;
  task: string;
  started_at: string;
  ended_at: string;
}

export interface ImportSummary {
  rows: ImportedRow[];
  skipped: number;
}

/** Разбор CSV с учётом кавычек и переводов строк внутри полей. */
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          quoted = false;
        }
      } else {
        field += ch;
      }
      continue;
    }
    if (ch === '"') {
      quoted = true;
    } else if (ch === ',' || ch === ';') {
      row.push(field);
      field = '';
    } else if (ch === '\n') {
      row.push(field);
      field = '';
      if (row.some((c) => c.trim() !== '')) rows.push(row);
      row = [];
    } else if (ch !== '\r') {
      field += ch;
    }
  }
  row.push(field);
  if (row.some((c) => c.trim() !== '')) rows.push(row);
  return rows;
}

/** Синонимы заголовков у Toggl / Clockify / Harvest. */
const COLUMNS = {
  project: ['project', 'проект', 'project name'],
  // Описание содержательнее типа работы: в Toggl оно в Description,
  // в Harvest — в Notes, а Task там хранит вид работы («Development»).
  task: ['description', 'notes', 'описание', 'задача', 'title', 'task'],
  startDate: ['start date', 'date', 'дата', 'spent date'],
  startTime: ['start time', 'начало'],
  endDate: ['end date'],
  endTime: ['end time', 'окончание'],
  duration: ['duration', 'duration (h)', 'hours', 'длительность', 'duration (decimal)'],
};

/** Индексы всех подходящих колонок в порядке приоритета синонимов. */
function findIndexes(header: string[], names: string[]): number[] {
  return names
    .map((n) => header.findIndex((h) => h.trim().toLowerCase() === n))
    .filter((i) => i >= 0);
}

/** «1:30:00» / «1.5» / «90» → секунды. */
function parseDuration(value: string): number {
  const raw = value.trim();
  if (!raw) return 0;
  if (raw.includes(':')) {
    const [h = '0', m = '0', s = '0'] = raw.split(':');
    return Number(h) * 3600 + Number(m) * 60 + Number(s);
  }
  const num = Number(raw.replace(',', '.'));
  if (!Number.isFinite(num)) return 0;
  // Часы в десятичном виде (Harvest) — целые минуты маловероятны.
  return Math.round(num * 3600);
}

function toIso(date: string, time: string): string | null {
  const d = date.trim();
  if (!d) return null;
  // Поддерживаем YYYY-MM-DD и DD.MM.YYYY.
  const iso = /^\d{4}-\d{2}-\d{2}$/.test(d)
    ? d
    : /^(\d{2})\.(\d{2})\.(\d{4})$/.test(d)
      ? d.replace(/^(\d{2})\.(\d{2})\.(\d{4})$/, '$3-$2-$1')
      : null;
  if (!iso) return null;
  const t = (time || '00:00:00').trim();
  const parsed = new Date(`${iso}T${t.length === 5 ? `${t}:00` : t}`);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

/** Разбирает CSV в записи времени; строки без валидного интервала пропускаются. */
export function parseTimeEntriesCsv(text: string): ImportSummary {
  const table = parseCsv(text);
  if (table.length < 2) return { rows: [], skipped: 0 };

  const header = table[0].map((h) => h.trim().toLowerCase());
  const idx = {
    project: findIndexes(header, COLUMNS.project),
    task: findIndexes(header, COLUMNS.task),
    startDate: findIndexes(header, COLUMNS.startDate),
    startTime: findIndexes(header, COLUMNS.startTime),
    endDate: findIndexes(header, COLUMNS.endDate),
    endTime: findIndexes(header, COLUMNS.endTime),
    duration: findIndexes(header, COLUMNS.duration),
  };

  const rows: ImportedRow[] = [];
  let skipped = 0;

  for (const cells of table.slice(1)) {
    // Первое непустое значение среди колонок-синонимов.
    const get = (list: number[]) =>
      list.map((i) => cells[i] ?? '').find((v) => v.trim() !== '') ?? '';
    const startedAt = toIso(get(idx.startDate), get(idx.startTime));
    if (!startedAt) {
      skipped++;
      continue;
    }
    let endedAt = toIso(
      get(idx.endDate) || get(idx.startDate),
      get(idx.endTime),
    );
    // Нет времени окончания — считаем от длительности.
    if (!endedAt || endedAt <= startedAt) {
      const seconds = parseDuration(get(idx.duration));
      if (!seconds) {
        skipped++;
        continue;
      }
      endedAt = new Date(
        new Date(startedAt).getTime() + seconds * 1000,
      ).toISOString();
    }
    const task = get(idx.task).trim() || 'Импортированная запись';
    rows.push({
      project: get(idx.project).trim() || null,
      task,
      started_at: startedAt,
      ended_at: endedAt,
    });
  }

  return { rows, skipped };
}
