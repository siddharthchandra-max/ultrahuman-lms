import React, { useState } from 'react';

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const DAYS = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];

function getCalendarDays(year, month) {
  const firstDay = new Date(year, month, 1).getDay();
  const offset = firstDay === 0 ? 6 : firstDay - 1; // Monday-start
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysInPrev = new Date(year, month, 0).getDate();
  const days = [];
  for (let i = offset - 1; i >= 0; i--) days.push({ day: daysInPrev - i, outside: true });
  for (let i = 1; i <= daysInMonth; i++) days.push({ day: i, outside: false });
  const remaining = 42 - days.length;
  for (let i = 1; i <= remaining; i++) days.push({ day: i, outside: true });
  return days;
}

function CalendarPanel({ label, year, month, selectedDate, onDateSelect, onMonthChange, onYearChange, onPrev, onNext }) {
  const days = getCalendarDays(year, month);
  const years = [];
  for (let y = 2020; y <= 2030; y++) years.push(y);

  return (
    <div className="drp-panel">
      <div className="drp-label">{label}</div>
      <div className="drp-controls">
        <div className="drp-selects">
          <select value={month} onChange={e => onMonthChange(Number(e.target.value))}>
            {MONTHS.map((m, i) => <option key={m} value={i}>{m}</option>)}
          </select>
          <select value={year} onChange={e => onYearChange(Number(e.target.value))}>
            {years.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
        <div className="drp-arrows">
          <span onClick={onPrev}>&lsaquo;</span>
          <span onClick={onNext}>&rsaquo;</span>
        </div>
      </div>
      <div className="drp-grid">
        {DAYS.map(d => <div key={d} className="drp-day-header">{d}</div>)}
        {days.map((d, i) => {
          const dateStr = d.outside ? null : `${year}-${String(month + 1).padStart(2, '0')}-${String(d.day).padStart(2, '0')}`;
          const isSelected = !d.outside && dateStr === selectedDate;
          return (
            <div
              key={i}
              className={`drp-day${d.outside ? ' outside' : ''}${isSelected ? ' selected' : ''}`}
              onClick={() => !d.outside && onDateSelect(dateStr)}
            >
              {d.day}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function DateRangePicker({ dateFrom, dateTo, onApply, onClose }) {
  const fromDate = new Date(dateFrom);
  const toDate = new Date(dateTo);
  const [startYear, setStartYear] = useState(fromDate.getFullYear());
  const [startMonth, setStartMonth] = useState(fromDate.getMonth());
  const [endYear, setEndYear] = useState(toDate.getFullYear());
  const [endMonth, setEndMonth] = useState(toDate.getMonth());
  const [selFrom, setSelFrom] = useState(dateFrom);
  const [selTo, setSelTo] = useState(dateTo);

  const prevStart = () => {
    if (startMonth === 0) { setStartMonth(11); setStartYear(y => y - 1); }
    else setStartMonth(m => m - 1);
  };
  const nextStart = () => {
    if (startMonth === 11) { setStartMonth(0); setStartYear(y => y + 1); }
    else setStartMonth(m => m + 1);
  };
  const prevEnd = () => {
    if (endMonth === 0) { setEndMonth(11); setEndYear(y => y - 1); }
    else setEndMonth(m => m - 1);
  };
  const nextEnd = () => {
    if (endMonth === 11) { setEndMonth(0); setEndYear(y => y + 1); }
    else setEndMonth(m => m + 1);
  };

  return (
    <div className="drp-overlay" onClick={onClose}>
      <div className="drp-container" onClick={e => e.stopPropagation()}>
        <div className="drp-calendars">
          <CalendarPanel
            label="Start Date"
            year={startYear} month={startMonth}
            selectedDate={selFrom}
            onDateSelect={setSelFrom}
            onMonthChange={setStartMonth} onYearChange={setStartYear}
            onPrev={prevStart} onNext={nextStart}
          />
          <CalendarPanel
            label="End Date"
            year={endYear} month={endMonth}
            selectedDate={selTo}
            onDateSelect={setSelTo}
            onMonthChange={setEndMonth} onYearChange={setEndYear}
            onPrev={prevEnd} onNext={nextEnd}
          />
        </div>
        <div className="drp-footer">
          <button className="drp-btn-cancel" onClick={onClose}>Cancel</button>
          <button className="drp-btn-apply" onClick={() => { onApply(selFrom, selTo); onClose(); }}>Apply</button>
        </div>
      </div>
    </div>
  );
}
