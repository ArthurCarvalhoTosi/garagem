import type { Due } from '../due';
import {
  costForecast,
  formatMonthLong,
  formatMonthShort,
  formatMonthYear,
  gapLabel,
  logFacts,
  timingLabel,
  type TimelineItem,
  type TimelineLog,
} from '../timeline';

const oil: TimelineItem = {
  id: 'oil',
  name: 'Troca de óleo e filtro',
  intervalKm: 10000,
  intervalMonths: 12,
  startKm: 30000,
  startDate: '2024-01-10',
};
let n = 0;
const log = (over: Partial<TimelineLog>): TimelineLog => ({
  id: `log${++n}`,
  itemId: 'oil',
  performedAt: '2024-06-01',
  km: 35000,
  costCents: null,
  ...over,
});

describe('logFacts', () => {
  it('judges the first log against the marco zero and the next against the previous log', () => {
    const first = log({ performedAt: '2024-12-01', km: 39000 });
    const second = log({ performedAt: '2025-11-20', km: 50100 });
    const facts = logFacts([second, first], [oil]);

    expect(facts.get(first.id)).toEqual({ timing: { late: false }, gap: null });
    // Due at 49.000 km: 1.100 km late, within 12 months.
    expect(facts.get(second.id)).toEqual({
      timing: { late: true, km: 1100 },
      gap: { km: 11100, days: 354 },
    });
  });

  it('flags lateness by time when the km limit was not passed', () => {
    const late = log({ performedAt: '2025-01-30', km: 36000 });
    // Due 2025-01-10.
    expect(logFacts([late], [oil]).get(late.id)?.timing).toEqual({ late: true, days: 20 });
  });

  it('has nothing to compare with for a log from before the car was added', () => {
    const backfilled = log({ performedAt: '2023-08-01', km: 25000 });
    expect(logFacts([backfilled], [oil]).get(backfilled.id)).toEqual({ timing: null, gap: null });
  });

  it('skips timing for an item without an interval or a removed item', () => {
    const free = { ...oil, id: 'free', intervalKm: null, intervalMonths: null };
    const a = log({ itemId: 'free' });
    const b = log({ itemId: 'gone' });
    const facts = logFacts([a, b], [free]);

    expect(facts.get(a.id)?.timing).toBeNull();
    expect(facts.get(b.id)).toEqual({ timing: null, gap: null });
  });
});

describe('labels', () => {
  it('reads timing and gaps in plain pt-BR', () => {
    expect(timingLabel({ late: false })).toBe('No prazo');
    expect(timingLabel({ late: true, km: 1100 })).toBe('1.100 km depois do previsto');
    expect(timingLabel({ late: true, days: 1 })).toBe('1 dia depois do previsto');
    expect(timingLabel({ late: true, days: 95 })).toBe('3 meses depois do previsto');
    expect(gapLabel({ km: 9800, days: 365 })).toBe('9.800 km em 12 meses');
    expect(gapLabel({ km: 400, days: 20 })).toBe('400 km em 20 dias');
    expect(gapLabel(null)).toBe('Primeira vez registrada');
  });

  it('formats months for the chart and screen readers', () => {
    expect(formatMonthYear('2027-09-14')).toBe('set. de 2027');
    expect(formatMonthShort('2027-09-01')).toBe('set');
    expect(formatMonthLong('2027-09-01')).toBe('setembro');
  });
});

describe('costForecast', () => {
  const today = '2026-11-03';
  const due = (dueDate: string | null): Due => ({
    dueDate,
    daysLeft: null,
    dueKm: null,
    kmLeft: null,
    dueBy: 'time',
    urgency: 'ok',
  });
  const item = (id: string) => ({ id, name: `Item ${id}` });
  const paid = [
    log({ itemId: 'a', performedAt: '2025-01-01', costCents: 30000 }),
    log({ itemId: 'a', performedAt: '2025-11-15', costCents: 35000 }),
    log({ itemId: 'a', performedAt: '2026-01-01', costCents: null }),
    log({ itemId: 'b', costCents: 8000 }),
  ];

  it('puts the last price paid in the month each item is due', () => {
    const { months, totalCents } = costForecast(
      [
        { item: item('a'), due: due('2026-11-15') },
        { item: item('b'), due: due('2027-02-10') },
      ],
      paid,
      today,
    );

    expect(months).toHaveLength(12);
    expect(months[0]).toEqual({ month: '2026-11-01', cents: 35000, unknown: [] });
    expect(months[3]).toEqual({ month: '2027-02-01', cents: 8000, unknown: [] });
    expect(months[11].month).toBe('2027-10-01');
    expect(totalCents).toBe(43000);
  });

  it('lists items without a price, puts overdue ones in this month and leaves out later ones', () => {
    const { months, totalCents } = costForecast(
      [
        { item: item('new'), due: due('2027-09-01') },
        { item: item('b'), due: due('2026-08-01') },
        { item: item('a'), due: due('2027-11-01') },
        { item: item('x'), due: due(null) },
      ],
      paid,
      today,
    );

    expect(months[10].unknown).toEqual(['Item new']);
    expect(months[0].cents).toBe(8000);
    expect(totalCents).toBe(8000);
  });
});
