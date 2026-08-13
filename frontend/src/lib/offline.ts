import { api } from './api';

/** Оффлайн-очередь ручных записей: localStorage → синк при подключении. */
export interface QueuedEntry {
  task_id?: string;
  description?: string;
  started_at: string;
  ended_at: string;
}

const QUEUE_KEY = 'tt_offline_queue';

export function readQueue(): QueuedEntry[] {
  try {
    return JSON.parse(window.localStorage.getItem(QUEUE_KEY) ?? '[]');
  } catch {
    return [];
  }
}

export function enqueueEntry(entry: QueuedEntry): void {
  const queue = readQueue();
  queue.push(entry);
  window.localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
}

/** Отправляет очередь на сервер; возвращает число синхронизированных записей. */
export async function flushQueue(): Promise<number> {
  const queue = readQueue();
  if (queue.length === 0) return 0;
  const failed: QueuedEntry[] = [];
  let sent = 0;
  for (const entry of queue) {
    try {
      await api.createManualEntry(entry);
      sent++;
    } catch {
      failed.push(entry);
    }
  }
  window.localStorage.setItem(QUEUE_KEY, JSON.stringify(failed));
  return sent;
}
