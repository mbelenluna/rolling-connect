'use client';

import { useState } from 'react';

/** Format date as YYYY-MM-DD in local timezone */
function toDateString(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Get today's date string in user's local timezone */
export function getTodayLocal(): string {
  return toDateString(new Date());
}

/** Check if dateStr is in the future (after today in user's timezone) */
export function isFutureDate(dateStr: string): boolean {
  return dateStr > getTodayLocal();
}

type DateRangePickerProps = {
  startDate: string | null;
  endDate: string | null;
  onRangeChange: (start: string | null, end: string | null) => void;
  startLabel: string;
  endLabel: string;
  selectHint: string;
};

export default function DateRangePicker({
  startDate,
  endDate,
  onRangeChange,
  startLabel,
  endLabel,
  selectHint,
}: DateRangePickerProps) {
  const [viewDate, setViewDate] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const [isOpen, setIsOpen] = useState(false);

  const todayStr = getTodayLocal();

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();

  // First day of month, and which weekday it falls on (0=Sun, 6=Sat)
  const firstDay = new Date(year, month, 1);
  const startOffset = firstDay.getDay();
  // Days in this month
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  // Build grid: 6 rows of 7 days
  const totalCells = 42;
  const days: (number | null)[] = [];
  for (let i = 0; i < startOffset; i++) days.push(null);
  for (let d = 1; d <= daysInMonth; d++) days.push(d);
  while (days.length < totalCells) days.push(null);

  const handleDateClick = (day: number) => {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    if (isFutureDate(dateStr)) return;

    if (!startDate) {
      onRangeChange(dateStr, null);
    } else if (!endDate) {
      if (dateStr < startDate) {
        onRangeChange(dateStr, null);
      } else {
        onRangeChange(startDate, dateStr);
        setIsOpen(false);
      }
    } else {
      onRangeChange(dateStr, null);
    }
  };

  const today = new Date();
  const isViewingCurrentOrFutureMonth = year > today.getFullYear() || (year === today.getFullYear() && month >= today.getMonth());

  const prevMonth = () => setViewDate(new Date(year, month - 1, 1));
  const nextMonth = () => {
    if (!isViewingCurrentOrFutureMonth) setViewDate(new Date(year, month + 1, 1));
  };

  const monthLabel = viewDate.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  const formatDisplayDate = (s: string | null) =>
    s ? new Date(s + 'T12:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : '—';

  return (
    <div className="relative">
      <div className="flex flex-wrap items-end gap-4">
        <div>
          <label className="block text-sm text-slate-500 mb-1">{startLabel}</label>
          <button
            type="button"
            onClick={() => setIsOpen(!isOpen)}
            className="px-3 py-2 border border-slate-200 rounded-lg text-slate-900 bg-white min-w-[140px] text-left hover:border-slate-300"
          >
            {formatDisplayDate(startDate)}
          </button>
        </div>
        <div>
          <label className="block text-sm text-slate-500 mb-1">{endLabel}</label>
          <button
            type="button"
            onClick={() => setIsOpen(!isOpen)}
            className="px-3 py-2 border border-slate-200 rounded-lg text-slate-900 bg-white min-w-[140px] text-left hover:border-slate-300 disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={!startDate}
          >
            {formatDisplayDate(endDate)}
          </button>
        </div>
      </div>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-40"
            aria-hidden="true"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute left-0 top-full mt-2 z-50 bg-white rounded-xl border border-slate-200 shadow-lg p-4 min-w-[280px]">
            <p className="text-xs text-slate-500 mb-3">{selectHint}</p>
            <div className="flex items-center justify-between mb-3">
              <button
                type="button"
                onClick={prevMonth}
                className="p-1 rounded hover:bg-slate-100 text-slate-600"
                aria-label="Previous month"
              >
                ←
              </button>
              <span className="font-medium text-slate-900">{monthLabel}</span>
              <button
                type="button"
                onClick={nextMonth}
                disabled={isViewingCurrentOrFutureMonth}
                className="p-1 rounded hover:bg-slate-100 text-slate-600 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent"
                aria-label="Next month"
              >
                →
              </button>
            </div>
            <div className="grid grid-cols-7 gap-1 text-center text-xs text-slate-500 mb-2">
              {dayNames.map((d) => (
                <div key={d}>{d}</div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1">
              {days.map((day, i) => {
                if (day === null) return <div key={i} />;
                const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                const isFuture = isFutureDate(dateStr);
                const isStart = dateStr === startDate;
                const isEnd = dateStr === endDate;
                const inRange =
                  startDate &&
                  endDate &&
                  dateStr >= startDate &&
                  dateStr <= endDate;
                const isToday = dateStr === todayStr;

                return (
                  <button
                    key={i}
                    type="button"
                    onClick={() => handleDateClick(day)}
                    disabled={isFuture}
                    className={`
                      w-8 h-8 rounded-lg text-sm font-medium transition
                      ${isFuture ? 'text-slate-300 cursor-not-allowed' : 'hover:bg-slate-100'}
                      ${isStart || isEnd ? 'bg-brand-600 text-white hover:bg-brand-700' : ''}
                      ${inRange && !isStart && !isEnd ? 'bg-brand-100 text-brand-800' : ''}
                      ${!inRange && !isStart && !isEnd && !isFuture ? 'text-slate-900' : ''}
                      ${isToday && !isStart && !isEnd ? 'ring-1 ring-slate-300' : ''}
                    `}
                  >
                    {day}
                  </button>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
