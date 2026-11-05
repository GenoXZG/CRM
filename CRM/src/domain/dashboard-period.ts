import { BusinessError } from './business-error';

// Existing datetime-local captures are stored as civil dates in UTC. Do not shift them.
// The operating day follows Mexico City, independently of the server's timezone.
export function operatingToday(now = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Mexico_City', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now);
  const part = (name: string) => parts.find(value => value.type === name)!.value;
  return `${part('year')}-${part('month')}-${part('day')}`;
}
export function shiftDay(date: string, amount: number): string {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + amount);
  return value.toISOString().slice(0, 10);
}
export function dashboardPeriod(input: Record<string, unknown>, today = operatingToday()) {
  const date = typeof input.date === 'string' && input.date ? input.date : today;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(date)) || new Date(date).toISOString().slice(0, 10) !== date || date < '1000-02-01' || date > '9999-11-30')
    throw new BusinessError(400, 'Fecha de agenda inválida');
  const view = typeof input.view === 'string' && input.view ? input.view : 'week';
  if (!['day', 'week', 'month'].includes(view)) throw new BusinessError(400, 'Vista de agenda inválida');
  const weekday = (new Date(date).getUTCDay() + 6) % 7;
  const start = view === 'month' ? `${date.slice(0, 7)}-01` : view === 'week' ? shiftDay(date, -weekday) : date;
  const nextMonth = new Date(`${start}T00:00:00Z`); nextMonth.setUTCMonth(nextMonth.getUTCMonth() + 1);
  const end = view === 'month' ? nextMonth.toISOString().slice(0, 10) : shiftDay(start, view === 'week' ? 7 : 1);
  const days = Math.round((Date.parse(end) - Date.parse(start)) / 86400000);
  return { today, date, view, start, end, days, previous: shiftDay(start, -1), next: end };
}
