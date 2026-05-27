// ============================================================
// МОДУЛЬ 02: УТИЛИТЫ И ХЕЛПЕРЫ
// ============================================================
// saveDb()                 — сохранить db в localStorage
// getMetricsForPeriod()    — считать метрики за период
// updateMetrics()          — обновить карточки сводки
// initDynamicPeriods()     — заполнить все <select> периодов
// updateClock()            — часы в шапке
// ============================================================

// --- Сохранение БД ---
function saveDb() {
    localStorage.setItem('controllerDataV3', JSON.stringify(db));
}

// --- Метрики за произвольный период ---
function getMetricsForPeriod(periodCode) {
    if (!periodCode) return { total: 0, substantial: 0, inProgress: 0, resolved: 0 };
    const parts = periodCode.split('-');
    const year = parseInt(parts[0]);
    const type = parts[1];
    let targetMonthIndices = [];
    if (type.startsWith('Q')) {
        if (type === 'Q1') targetMonthIndices = [0, 1, 2];
        else if (type === 'Q2') targetMonthIndices = [3, 4, 5];
        else if (type === 'Q3') targetMonthIndices = [6, 7, 8];
        else if (type === 'Q4') targetMonthIndices = [9, 10, 11];
    } else {
        targetMonthIndices = [parseInt(type)];
    }
    const events = db.events.filter(e => {
        const d = new Date(e.date);
        return d.getFullYear() === year && targetMonthIndices.includes(d.getMonth());
    });
    return {
        total: events.length,
        substantial: events.filter(e => e.isSubstantial).length,
        inProgress: events.filter(e => e.status === 'В работе' || e.status === 'Выявлено').length,
        resolved: events.filter(e => e.status === 'Устранено').length
    };
}

// --- Читабельное название периода ---
function getReadablePeriodLabel(code) {
    const ruMonths = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];
    const parts = code.split('-');
    const year = parts[0];
    const type = parts[1];
    if (type.startsWith('Q')) return `${type} ${year}`;
    return `${ruMonths[parseInt(type)]} ${year}`;
}

// --- Обновить карточки метрик на сводке ---
function updateMetrics() {
    const p1Code = document.getElementById('period1').value;
    const p2Code = document.getElementById('period2').value;
    if (!p1Code || !p2Code) return;

    const p1Data = getMetricsForPeriod(p1Code);
    const p2Data = getMetricsForPeriod(p2Code);
    const p1Label = getReadablePeriodLabel(p1Code);
    const p2Label = getReadablePeriodLabel(p2Code);

    const updateStat = (id, cur, prev) => {
        const diff = cur - prev;
        let color = 'text-gray-500', icon = '▬';
        if (diff > 0) { icon = '▲'; color = 'text-red-500'; }
        if (diff < 0) { icon = '▼'; color = 'text-green-500'; }
        if (id.includes('resolved') && diff > 0) color = 'text-green-500';
        document.getElementById(`${id}-events`).textContent = cur;
        document.getElementById(`${id}-diff`).innerHTML = `vs ${prev} (${p1Label}) <span class="${color}">${icon}</span>`;
    };

    updateStat('metric-total', p2Data.total, p1Data.total);
    updateStat('metric-substantial', p2Data.substantial, p1Data.substantial);
    updateStat('metric-inprogress', p2Data.inProgress, p1Data.inProgress);
    updateStat('metric-resolved', p2Data.resolved, p1Data.resolved);

    if (kpiComparisonChart) {
        kpiComparisonChart.data.labels = [p1Label, p2Label];
        kpiComparisonChart.data.datasets[0].data = [p1Data.total, p2Data.total];
        kpiComparisonChart.data.datasets[1].data = [p1Data.substantial, p2Data.substantial];
        kpiComparisonChart.data.datasets[2].data = [p1Data.inProgress, p2Data.inProgress];
        kpiComparisonChart.data.datasets[3].data = [p1Data.resolved, p2Data.resolved];
        kpiComparisonChart.update();
    }
}

// --- Заполнить все <select> для выбора периода ---
function initDynamicPeriods() {
    const startYear = 2025;
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();
    const ruMonths = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];

    const quarters = [];
    const months = [];
    for (let y = startYear; y <= currentYear; y++) {
        const maxMonth = (y === currentYear) ? currentMonth : 11;
        if (maxMonth >= 0)  quarters.push({ val: `${y}-Q1`, text: `Q1 ${y}` });
        if (maxMonth >= 3)  quarters.push({ val: `${y}-Q2`, text: `Q2 ${y}` });
        if (maxMonth >= 6)  quarters.push({ val: `${y}-Q3`, text: `Q3 ${y}` });
        if (maxMonth >= 9)  quarters.push({ val: `${y}-Q4`, text: `Q4 ${y}` });
        for (let m = 0; m <= maxMonth; m++) {
            months.push({ val: `${y}-${m}`, text: `${ruMonths[m]} ${y}` });
        }
    }

    const fillSelect = (sel, opts, groupLabel) => {
        if (!sel) return;
        sel.innerHTML = '';
        const group = document.createElement('optgroup');
        group.label = groupLabel;
        opts.forEach(o => {
            const el = document.createElement('option');
            el.value = o.val;
            el.textContent = o.text;
            group.appendChild(el);
        });
        sel.appendChild(group);
    };

    const p1 = document.getElementById('period1');
    const p2 = document.getElementById('period2');
    [p1, p2].forEach(sel => {
        if (!sel) return;
        fillSelect(sel, quarters, "Кварталы");
        fillSelect(sel, months, "Месяцы");
        if (sel === p2 && months.length > 0) sel.value = months[months.length - 1].val;
    });

    const checkMonth = document.getElementById('check-month');
    if (checkMonth) { fillSelect(checkMonth, months, "Периоды"); checkMonth.value = months[months.length - 1].val; }

    const repQuarter = document.getElementById('report-quarter');
    if (repQuarter) { fillSelect(repQuarter, quarters, "Отчетные периоды"); if (quarters.length > 0) repQuarter.value = quarters[quarters.length - 1].val; }

    const ganttSel = document.getElementById('gantt-quarter-select');
    if (ganttSel) {
        ganttSel.innerHTML = '';
        fillSelect(ganttSel, quarters, "Кварталы");
        if (quarters.length > 0) {
            ganttSel.value = quarters[quarters.length - 1].val;
            setTimeout(() => updateGanttChart(ganttSel.value), 0);
        }
    }

    const pdfSel = document.getElementById('pdf-quarter-select');
    if (pdfSel) {
        pdfSel.innerHTML = '<option value="">Все время</option>';
        quarters.slice().reverse().forEach(q => {
            const el = document.createElement('option');
            el.value = q.val;
            el.textContent = q.text;
            pdfSel.appendChild(el);
        });
        if (quarters.length > 0) pdfSel.value = quarters[quarters.length - 1].val;
    }

    const planYearSel = document.getElementById('plan-year-select');
    if (planYearSel) {
        const cur = new Date().getFullYear();
        planYearSel.innerHTML = '';
        for (let y = cur - 1; y <= cur + 2; y++) {
            const opt = document.createElement('option');
            opt.value = y;
            opt.textContent = y + ' год';
            if (y === cur) opt.selected = true;
            planYearSel.appendChild(opt);
        }
    }
}

// --- Часы ---
function updateClock() {
    const now = new Date();
    const dateStr = now.toLocaleDateString('ru-RU', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    const timeStr = now.toLocaleTimeString('ru-RU');
    const dateEl = document.getElementById('current-date');
    const timeEl = document.getElementById('current-time');
    if (dateEl) dateEl.textContent = dateStr.charAt(0).toUpperCase() + dateStr.slice(1);
    if (timeEl) timeEl.textContent = timeStr;
}
setInterval(updateClock, 1000);
updateClock();

// --- Аккордеон (База Знаний) ---
function toggleAccordion(id) {
    const content = document.getElementById(id);
    const icon = document.getElementById('icon-' + id);
    if (!content) return;
    const hidden = content.classList.toggle('hidden');
    if (icon) icon.style.transform = hidden ? 'rotate(0deg)' : 'rotate(180deg)';
}

// --- Предупреждение при закрытии с несохранёнными данными ---
function checkUnsavedChanges() {
    return JSON.stringify(db) !== _lastSavedSnapshot;
}
window.addEventListener('beforeunload', function(e) {
    if (checkUnsavedChanges()) {
        e.preventDefault();
        e.returnValue = '';
    }
});
