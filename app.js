// Payroll Calendar Generator - Vanilla JS

const $ = id => document.getElementById(id);
const calendarContainer = $('calendarContainer');
const summaryEl = $('summary');

let renderedYears = new Set();
let lastRenderedYear = new Date().getFullYear();

function init() {
  populatePrintYears();
  $('renderScroll').addEventListener('click', onRenderScroll);
  $('loadMore').addEventListener('click', onLoadMore);
  $('renderYear').addEventListener('click', onRenderYear);
  $('doPrint').addEventListener('click', () => window.print());
}

function populatePrintYears() {
  const sel = $('printYear');
  const now = new Date().getFullYear();
  for (let y = now - 5; y <= now + 5; y++) {
    const o = document.createElement('option');
    o.value = y;
    o.textContent = y;
    if (y === now) o.selected = true;
    sel.appendChild(o);
  }
}

function onRenderScroll() {
  const freq = $('frequency').value;
  const last = $('lastPayment').value ? parseDateInput($('lastPayment').value) : null;
  const amount = parseFloat($('amount').value) || 0;
  calendarContainer.innerHTML = '';
  renderedYears.clear();
  lastRenderedYear = new Date().getFullYear();
  appendYearRange(lastRenderedYear, 3, { freq, last, amount });
  updateSummary();
}

function onLoadMore() {
  const freq = $('frequency').value;
  const last = $('lastPayment').value ? parseDateInput($('lastPayment').value) : null;
  const amount = parseFloat($('amount').value) || 0;
  appendYearRange(lastRenderedYear + 1, 3, { freq, last, amount });
  updateSummary();
}

function onRenderYear() {
  const year = parseInt($('printYear').value, 10);
  const freq = $('frequency').value;
  const last = $('lastPayment').value ? parseDateInput($('lastPayment').value) : null;
  const amount = parseFloat($('amount').value) || 0;
  calendarContainer.innerHTML = '';
  // Render months for this year in calendar-container (print CSS will handle grid)
  for (let m = 0; m < 12; m++) {
    const monthEl = renderMonth(year, m, { freq, last, amount });
    calendarContainer.appendChild(monthEl);
  }
  updateSummary();
}

function appendYearRange(startYear, count, opts) {
  for (let y = startYear; y < startYear + count; y++) {
    if (renderedYears.has(y)) continue;
    for (let m = 0; m < 12; m++) {
      const monthEl = renderMonth(y, m, opts);
      calendarContainer.appendChild(monthEl);
    }
    renderedYears.add(y);
    lastRenderedYear = y;
  }
}

function renderMonth(year, monthIndex, opts) {
  const { freq, last, amount } = opts || {};
  const monthStart = new Date(year, monthIndex, 1);
  const monthName = monthStart.toLocaleString(undefined, { month: 'long' });
  const monthEl = document.createElement('article');
  monthEl.className = 'month';
  const h = document.createElement('h3');
  h.textContent = `${monthName} ${year}`;
  monthEl.appendChild(h);

  const grid = document.createElement('div');
  grid.className = 'grid';
  const dayOrder = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
  dayOrder.forEach(d => {
    const dt = document.createElement('div');
    dt.className = 'daytitle';
    dt.textContent = d;
    grid.appendChild(dt);
  });

  // Determine first day offset and number of days
  const firstWeekday = monthStart.getDay();
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();

  // add blanks
  for (let i = 0; i < firstWeekday; i++) {
    const blank = document.createElement('div');
    blank.className = 'daycell';
    grid.appendChild(blank);
  }

  // compute holidays for year
  const holidays = computeHolidays(year);

  // compute paydays in the month
  const paydays = computePaydaysInRange(year, monthIndex, freq, last);

  let monthTotal = 0;
  for (let d = 1; d <= daysInMonth; d++) {
    const date = new Date(year, monthIndex, d);
    const cell = document.createElement('div');
    cell.className = 'daycell';
    const dateSpan = document.createElement('div');
    dateSpan.className = 'date';
    dateSpan.textContent = d;
    cell.appendChild(dateSpan);

    const key = isoLocal(date);
    if (holidays.has(key)) {
      cell.classList.add('holiday');
      const label = document.createElement('div');
      label.style.marginTop = '20px';
      label.textContent = holidays.get(key);
      cell.appendChild(label);
    }
    if (paydays.has(key)) {
      cell.classList.add('payday');
      const p = document.createElement('div');
      p.className = 'paylabel';
      p.textContent = 'Payday';
      cell.appendChild(p);
      if (amount > 0) {
        monthTotal += amount;
      }
    }

    grid.appendChild(cell);
  }

  monthEl.appendChild(grid);
  const totals = document.createElement('div');
  totals.className = 'totals';
  totals.textContent = `Month total: ${formatMoney(monthTotal)}`;
  monthEl.appendChild(totals);
  return monthEl;
}

function updateSummary() {
  const amount = parseFloat($('amount').value) || 0;
  const freq = $('frequency').value;
  // compute yearly total based on currently rendered months
  const months = calendarContainer.querySelectorAll('.month');
  let yearlyTotal = 0;
  months.forEach(m => {
    const txt = m.querySelector('.totals').textContent;
    const val = parseFloat(txt.replace(/[^0-9.-]+/g, '')) || 0;
    yearlyTotal += val;
  });
  summaryEl.textContent = `Rendered months: ${months.length}. Current displayed total (sum of month totals): ${formatMoney(
    yearlyTotal
  )}.`;
}

function computeHolidays(year) {
  const map = new Map();
  function add(d, label) {
    map.set(isoLocal(d), label);
  }
  add(new Date(year, 0, 1), "New Year's Day");
  add(nthWeekdayOfMonth(year, 0, 1, 3), 'MLK Day'); // 3rd Monday Jan
  add(lastWeekdayOfMonth(year, 4, 1), 'Memorial Day'); // last Monday May
  add(new Date(year, 6, 4), 'Independence Day');
  add(nthWeekdayOfMonth(year, 8, 1, 1), 'Labor Day'); // 1st Monday Sep
  add(nthWeekdayOfMonth(year, 10, 4, 4), 'Thanksgiving'); // fourth Thursday Nov
  add(new Date(year, 11, 25), 'Christmas');
  add(new Date(year, 5, 19), 'Juneteenth');
  return map;
}

// helper: nthWeekdayOfMonth(year, monthIndex (0-based), weekday(0=Sun), nth)
function nthWeekdayOfMonth(year, month, weekday, nth) {
  const first = new Date(year, month, 1);
  const firstWeekday = first.getDay();
  let day = 1 + ((7 + weekday - firstWeekday) % 7) + (nth - 1) * 7;
  return new Date(year, month, day);
}

// last weekday of a month
function lastWeekdayOfMonth(year, month, weekday) {
  const last = new Date(year, month + 1, 0);
  const lastDay = last.getDate();
  const lastWeekday = last.getDay();
  const diff = (7 + lastWeekday - weekday) % 7;
  return new Date(year, month, lastDay - diff);
}

function computePaydaysInRange(year, monthIndex, freq, lastPaymentDate) {
  const set = new Set();
  if (!lastPaymentDate) return set;
  const start = new Date(year, monthIndex, 1);
  const end = new Date(year, monthIndex + 1, 0);

  // Find a payday sequence anchored at lastPaymentDate and generate dates forward/backward
  // Normalize times
  const anchor = new Date(lastPaymentDate.getFullYear(), lastPaymentDate.getMonth(), lastPaymentDate.getDate());
  const stepDays = freq === 'weekly' ? 7 : freq === 'biweekly' ? 14 : null;

  if (freq === 'monthly') {
    // monthly: attempt to use same day-of-month as anchor; if day doesn't exist, skip that month
    const dayOfMonth = anchor.getDate();
    const candidate = new Date(year, monthIndex, dayOfMonth);
    if (candidate.getMonth() === monthIndex) set.add(isoLocal(candidate));
    return set;
  }

  // For weekly/biweekly walk from anchor forward/backward into range
  // Move backward until before start
  let d = new Date(anchor);
  while (d > start) {
    d.setDate(d.getDate() - stepDays);
  }
  // Step forward until after end
  while (d <= end) {
    if (d >= start && d <= end) set.add(isoLocal(new Date(d)));
    d.setDate(d.getDate() + stepDays);
  }
  return set;
}

function isoLocal(d) {
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

function parseDateInput(value) {
  // value expected as "YYYY-MM-DD" from <input type="date">; build a local Date
  const parts = String(value).split('-').map(Number);
  if (parts.length !== 3) return null;
  const [y, m, d] = parts;
  return new Date(y, m - 1, d);
}
function formatMoney(v) {
  return '$' + v.toFixed(2);
}

// Init on load
document.addEventListener('DOMContentLoaded', init);
