import { CalendarEvent } from '../types';
import { NationalHoliday } from './academicCalendarEngine';

export type EventHoliday = Pick<CalendarEvent, 'id' | 'title' | 'date' | 'endDate'>;

export const getEventHolidayRanges = (events: CalendarEvent[] = []): EventHoliday[] =>
  events.filter((event) => event.category === 'holiday' && event.date)
    .map(({ id, title, date, endDate }) => ({ id, title, date, endDate }))
    .filter((holiday) => !holiday.endDate || holiday.endDate >= holiday.date);

export const isEventHolidayOnDate = (date: string, holidays: EventHoliday[] = []): boolean =>
  holidays.some((holiday) => holiday.date <= date && (holiday.endDate || holiday.date) >= date);

/** Expand inclusive event ranges into date records understood by attendance summaries. */
export const mergeEventHolidays = (
  configured: NationalHoliday[] = [],
  eventHolidays: EventHoliday[] = []
): NationalHoliday[] => {
  const byDate = new Map(configured.map((holiday) => [holiday.date, holiday]));
  for (const holiday of eventHolidays) {
    const end = holiday.endDate || holiday.date;
    const cursor = new Date(`${holiday.date}T12:00:00`);
    const last = new Date(`${end}T12:00:00`);
    while (cursor <= last) {
      const date = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}-${String(cursor.getDate()).padStart(2, '0')}`;
      if (!byDate.has(date)) byDate.set(date, { id: `${holiday.id}:${date}`, name: holiday.title, date });
      cursor.setDate(cursor.getDate() + 1);
    }
  }
  return [...byDate.values()];
};
