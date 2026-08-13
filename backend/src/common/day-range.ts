import { BadRequestException } from '@nestjs/common';

/** Returns the [start, end] timestamps covering a UTC calendar day. */
export function dayRange(date?: string): { start: Date; end: Date } {
  const base = date ? new Date(`${date}T00:00:00.000Z`) : new Date();
  if (Number.isNaN(base.getTime())) {
    throw new BadRequestException('Invalid date, expected YYYY-MM-DD');
  }
  const start = new Date(
    Date.UTC(
      base.getUTCFullYear(),
      base.getUTCMonth(),
      base.getUTCDate(),
      0,
      0,
      0,
      0,
    ),
  );
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000 - 1);
  return { start, end };
}
