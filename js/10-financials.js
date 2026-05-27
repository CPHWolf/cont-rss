// ============================================================
// МОДУЛЬ 10: ФИНАНСОВЫЕ ПОКАЗАТЕЛИ (НДК, НКЛ, Собственные средства)

// Форматирует дату в локальном времени как YYYY-MM-DD (без сдвига UTC)
function _localDateStr(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}
// ============================================================
// initFinancials()    — инициализация
// updateFinUnit()     — переключить единицы
// getFinStatus()      — цвет статуса
// renderFinCards()    — карточки
// renderFinCharts()   — графики
// renderFinTable()    — таблица истории
// setNkdScale/setNklScale — лин/лог шкала
// saveFinRecord()     — добавить запись
// saveFinMins()       — сохранить минимумы
// deleteFinRecord()   — удалить
// exportFinToExcel()  — XLSX выгрузка
// addTrendDataset()   — линия тренда на графиках
// ============================================================


const FIN_LABELS = {
    nkd: 'НДК',
    nkl: 'НКЛ',
    equity: 'Собственные средства'
};

const FIN_UNITS = {
    nkd: '%',
    nkl: '%',
    equity: ''
};

function initFinancials() {
    if (!db.financials) {
        db.financials = { records: [], mins: { nkd: 100, nkl: 100, equity: 3000 }, zones: {} };
        saveDb();
    }
    if (!db.financials.mins) {
        db.financials.mins = { nkd: 100, nkl: 100, equity: 3000 };
        saveDb();
    }
    if (!db.financials.zones) {
        db.financials.zones = { mode: 'pct', yellow: 120, red: 110 };
        saveDb();
    }

    document.getElementById('fin-min-nkd').value    = db.financials.mins.nkd    ?? 100;
    document.getElementById('fin-min-nkl').value    = db.financials.mins.nkl    ?? 100;
    document.getElementById('fin-min-equity').value = db.financials.mins.equity ?? 3000;

    // Восстановить per-metric настройки зон
    const z = db.financials.zones;
    ['nkd', 'nkl', 'equity'].forEach(type => {
        const yEl = document.getElementById(`fin-zone-${type}-yellow`);
        const rEl = document.getElementById(`fin-zone-${type}-red`);
        if (yEl) yEl.value = z[type + '_yellow'] ?? ZONE_DEFAULTS[type]?.yellow ?? 120;
        if (rEl) rEl.value = z[type + '_red']    ?? ZONE_DEFAULTS[type]?.red    ?? 110;
    });

    const todayStr = new Date().toISOString().split('T')[0];
    document.getElementById('fin-date').value = todayStr;

    renderFinCards();
    renderFinCharts();
    renderFinTable();
    renderFinWarnings();
}

function updateFinUnit() {
    const type = document.getElementById('fin-type').value;
    document.getElementById('fin-unit-label').textContent = FIN_UNITS[type] || '%';
}

function getFinStatus(type, value) {
    const min = db.financials.mins[type] ?? 0;
    if (value === null || value === undefined || isNaN(value)) return { label: '—', ok: null };
    const ratio = value / min;
    if (ratio < 1) return { label: '⛔ Нарушение', ok: false };
    if (ratio < 1.1) return { label: '⚠ На грани', ok: 'warn' };
    return { label: '✅ Норма', ok: true };
}

function renderFinCards() {
    const records = db.financials?.records || [];
    const mins = db.financials?.mins || {};
    const types = ['nkd', 'nkl', 'equity'];

    types.forEach(type => {
        const typeRecords = records.filter(r => r.type === type).sort((a,b) => new Date(b.date) - new Date(a.date));
        const latest = typeRecords[0];
        const val = latest ? latest.value : null;
        const min = mins[type] ?? '—';
        const status = getFinStatus(type, val);

        const suffix = FIN_UNITS[type] === '%' ? '%' : '';
        const displayVal = val !== null ? val.toLocaleString('ru-RU', {maximumFractionDigits: 2}) + suffix : '—';
        const minDisplay = min !== null ? min.toLocaleString('ru-RU') + suffix : '—';

        const cardId = type === 'equity' ? 'card-equity' : `card-${type}`;
        const card = document.getElementById(cardId);
        document.getElementById(`${type === 'equity' ? 'equity' : type}-current-display`).textContent = displayVal;
        document.getElementById(`${type === 'equity' ? 'equity' : type}-min-display`).textContent = minDisplay;
        document.getElementById(`${type === 'equity' ? 'equity' : type}-last-date`).textContent = latest ? latest.date : '—';

        const badge = document.getElementById(`badge-${type === 'equity' ? 'equity' : type}`);
        badge.textContent = status.label;
        badge.className = 'text-xs font-bold px-2 py-1 rounded-full ';
        if (status.ok === true) {
            badge.className += 'bg-green-100 text-green-800';
            card.style.borderLeftColor = '#22c55e';
        } else if (status.ok === 'warn') {
            badge.className += 'bg-yellow-100 text-yellow-800';
            card.style.borderLeftColor = '#f59e0b';
        } else if (status.ok === false) {
            badge.className += 'bg-red-100 text-red-800';
            card.style.borderLeftColor = '#ef4444';
        } else {
            badge.className += 'bg-gray-100 text-gray-600';
            card.style.borderLeftColor = '#D9A86E';
        }
    });
}

let _nkdScaleType = 'linear';
let _nklScaleType = 'linear';
let _equityChartType = 'bar'; // 'bar' или 'line'

function renderFinCharts() {
    const records = (db.financials?.records || []).sort((a,b) => new Date(a.date) - new Date(b.date));
    const mins = db.financials?.mins || {};

    // Общая функция построения одиночного линейного графика ликвидности
    function buildLiqChart(canvasId, chartRef, type, color, minVal, scaleType) {
        const typeRecords = records.filter(r => r.type === type);
        const dates = typeRecords.map(r => r.date);
        const values = typeRecords.map(r => r.value);

        const ctx = document.getElementById(canvasId)?.getContext('2d');
        if (!ctx) return chartRef;
        if (chartRef) chartRef.destroy();

        const allVals = values.filter(v => v !== null && !isNaN(v) && v > 0);
        const isLog = scaleType === 'log';

        const yAxisConfig = isLog ? {
            type: 'logarithmic',
            title: { display: true, text: FIN_LABELS[type] + ', % (лог. шкала)', color: '#7D7471', font: { size: 11 } },
            ticks: {
                callback: v => (Number.isInteger(Math.log10(v)) || [1,2,5,10,20,50,100,200,500,1000,2000,5000,10000].includes(v)) ? v + '%' : null,
                color: '#7D7471',
                maxTicksLimit: 8
            },
            grid: { color: '#E0E0E0' }
        } : {
            type: 'linear',
            min: (() => {
                const dataMin = allVals.length ? Math.min(...allVals) : 0;
                return Math.min(0, dataMin * 0.9, minVal * 0.85);
            })(),
            ticks: { callback: v => v + '%', color: '#7D7471' },
            grid: { color: '#E0E0E0' }
        };

        return new Chart(ctx, {
            type: 'line',
            data: {
                labels: dates,
                datasets: [
                    {
                        label: FIN_LABELS[type] + ' (%)',
                        data: values,
                        borderColor: color,
                        backgroundColor: isLog ? 'transparent' : 'rgba(217,168,110,0.12)',
                        tension: 0.3,
                        fill: !isLog,
                        pointBackgroundColor: color,
                        pointRadius: 5,
                        spanGaps: true,
                        order: 2
                    },
                    {
                        label: `Минимум (${minVal}%)`,
                        data: dates.map(() => minVal),
                        borderColor: '#ef4444',
                        backgroundColor: 'transparent',
                        borderDash: [8, 4],
                        borderWidth: 2.5,
                        pointRadius: 0,
                        fill: false,
                        order: 1
                    }
                ]
            },
            options: {
                maintainAspectRatio: false, responsive: true,
                plugins: {
                    legend: _legendOpts()
                },
                scales: {
                    y: yAxisConfig,
                    x: { ticks: { color: '#7D7471', maxTicksLimit: 10 }, grid: { display: false } }
                }
            }
        });
    }

    financialsNkdChart = buildLiqChart('financialsNkdChart', financialsNkdChart, 'nkd', '#D9A86E', mins.nkd ?? 100, _nkdScaleType);
    financialsNklChart = buildLiqChart('financialsNklChart', financialsNklChart, 'nkl', '#4B4240', mins.nkl ?? 100, _nklScaleType);

    // --- Собственные средства ---
    renderEquityChart();
}

function renderEquityChart() {
    const records = (db.financials?.records || []).sort((a,b) => new Date(a.date) - new Date(b.date));
    const mins = db.financials?.mins || {};
    const eqRecords = records.filter(r => r.type === 'equity');
    const eqDates   = eqRecords.map(r => r.date);
    const eqData    = eqRecords.map(r => r.value);
    const eqMin     = mins.equity ?? 3000;
    const isLine    = _equityChartType === 'line';

    // Кнопки переключателя
    const btnBar  = document.getElementById('eq-type-bar');
    const btnLine = document.getElementById('eq-type-line');
    if (btnBar && btnLine) {
        btnBar.style.cssText  = !isLine ? 'background:var(--bg-nav,#4B4240);color:white;border-color:#4B4240;' : 'background:transparent;color:#7D7471;border-color:#A69C97;';
        btnLine.style.cssText =  isLine ? 'background:var(--bg-nav,#4B4240);color:white;border-color:#4B4240;' : 'background:transparent;color:#7D7471;border-color:#A69C97;';
    }

    const eqCtx = document.getElementById('financialsEquityChart')?.getContext('2d');
    if (!eqCtx) return;
    if (financialsEquityChart) financialsEquityChart.destroy();

    // EWMA и зоны для линейного режима
    const { redLine, yellowLine } = getZoneThresholds('equity', eqMin);

    // Датасеты в зависимости от типа графика
    let datasets;
    let allDates = eqDates;

    if (isLine) {
        // Линейный — как НДК/НКЛ, с EWMA и зонами
        const STEPS = 3;
        let forecastDates = [], forecastVals = [], levels = eqData, slopes = eqData.map(() => 0);
        if (eqData.length >= 2) {
            const holt = calcHolt(eqData, 0.3, 0.2);
            levels = holt.levels;
            slopes = holt.slopes;
            const fc = forecastHolt(levels, slopes, STEPS, eqDates[eqDates.length-1], eqDates);
            forecastDates = fc.forecastDates;
            forecastVals  = fc.forecastVals;
        }
        allDates = [...eqDates, ...forecastDates];
        const n = allDates.length;
        const frontPad = (arr, k) => [...Array(k).fill(null), ...arr];
        const forecastColor = forecastVals.length
            ? (forecastVals[forecastVals.length-1] < eqMin    ? '#ef4444'
               : forecastVals[forecastVals.length-1] < redLine    ? '#ef4444'
               : forecastVals[forecastVals.length-1] < yellowLine ? '#f59e0b' : '#22c55e')
            : '#22c55e';

        const zoneBg = buildZoneBgDatasets(allDates, eqMin, 'equity');

        datasets = [
            ...zoneBg,
            {
                label: 'Собств. средства',
                data: [...eqData, ...Array(forecastDates.length).fill(null)],
                borderColor: '#2563eb',
                backgroundColor: 'rgba(37,99,235,0.10)',
                tension: 0.3,
                fill: true,
                pointBackgroundColor: '#2563eb',
                pointRadius: 5,
                spanGaps: true,
                order: 3
            },
            {
                label: `Минимум (${eqMin.toLocaleString('ru-RU')})`,
                data: Array(n).fill(eqMin),
                borderColor: '#ef4444',
                borderDash: [8,4],
                borderWidth: 2.5,
                pointRadius: 0,
                fill: false,
                order: 2
            },
            {
                label: 'Тренд (Холт)',
                data: [...levels, ...Array(forecastDates.length).fill(null)],
                borderColor: 'rgba(80,80,80,0.60)',
                borderWidth: 1.8,
                borderDash: [3,3],
                pointRadius: 0,
                fill: false,
                tension: 0.3,
                order: 2
            },
            {
                label: 'Прогноз →',
                data: frontPad(forecastVals, eqDates.length),
                borderColor: forecastColor,
                borderWidth: 2,
                borderDash: [6,3],
                pointRadius: [...Array(eqDates.length).fill(0), ...Array(STEPS).fill(7)],
                pointStyle: 'triangle',
                pointBackgroundColor: forecastColor,
                fill: false,
                tension: 0,
                order: 1
            }
        ];
    } else {
        // Баровый — классический цветной по статусу
        datasets = [
            {
                label: 'Собств. средства',
                data: eqData,
                backgroundColor: eqData.map(v =>
                    v < eqMin ? 'rgba(239,68,68,0.65)'
                    : v < redLine ? 'rgba(239,68,68,0.45)'
                    : v < yellowLine ? 'rgba(245,158,11,0.55)'
                    : 'rgba(34,197,94,0.55)'
                ),
                borderRadius: 4,
                order: 2
            },
            {
                label: `Минимум (${eqMin.toLocaleString('ru-RU')})`,
                data: eqDates.map(() => eqMin),
                type: 'line',
                borderColor: '#ef4444',
                borderDash: [6,4],
                borderWidth: 2,
                pointRadius: 0,
                fill: false,
                order: 1
            }
        ];
    }

    financialsEquityChart = new Chart(eqCtx, {
        type: isLine ? 'line' : 'bar',
        data: { labels: allDates, datasets },
        options: _addForecastClickOptions({
            maintainAspectRatio: false,
            responsive: true,
            plugins: { legend: _legendOpts() },
            scales: {
                y: {
                    ticks: { callback: v => v.toLocaleString('ru-RU'), color: '#7D7471' },
                    grid: { color: '#E0E0E0' }
                },
                x: { ticks: { color: '#7D7471', maxTicksLimit: 12 }, grid: { display: false } }
            }
        }, 'equity')
    });
    // Привязать клик через canvas listener
    _attachForecastClickListener(financialsEquityChart, 'equity');
}

function renderFinTable() {
    const tbody = document.getElementById('fin-table-body');
    if (!tbody) return;
    const filterType = document.getElementById('fin-filter-type')?.value || '';
    const records = (db.financials?.records || [])
        .filter(r => !filterType || r.type === filterType)
        .sort((a, b) => new Date(b.date) - new Date(a.date));

    if (records.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="p-8 text-center text-[#A69C97] italic">Нет данных. Добавьте первую запись.</td></tr>';
        return;
    }

    tbody.innerHTML = '';
    records.forEach(rec => {
        const min = db.financials?.mins?.[rec.type] ?? 0;
        const status = getFinStatus(rec.type, rec.value);
        const suffix = FIN_UNITS[rec.type] === '%' ? '%' : '';
        let badgeClass = 'bg-gray-100 text-gray-600';
        if (status.ok === true) badgeClass = 'bg-green-100 text-green-700';
        else if (status.ok === 'warn') badgeClass = 'bg-yellow-100 text-yellow-700';
        else if (status.ok === false) badgeClass = 'bg-red-100 text-red-700';

        const tr = document.createElement('tr');
        tr.id = `fin-record-${rec.id}`;
        tr.className = 'border-b hover:bg-gray-50';
        tr.innerHTML = `
            <td class="p-3 text-sm font-semibold">${rec.date}</td>
            <td class="p-3 text-sm">${FIN_LABELS[rec.type] || rec.type}</td>
            <td class="p-3 text-sm font-bold text-[#4B4240]">${rec.value.toLocaleString('ru-RU', {maximumFractionDigits:2})}${suffix}</td>
            <td class="p-3 text-sm text-[#7D7471]">${min.toLocaleString('ru-RU')}${suffix}</td>
            <td class="p-3"><span class="text-xs font-bold px-2 py-1 rounded-full ${badgeClass}">${status.label}</span></td>
            <td class="p-3 text-sm text-[#7D7471]">${rec.comment || '—'}</td>
            <td class="p-3">
                <button onclick="deleteFinRecord(${rec.id})" class="text-red-400 hover:text-red-600 text-sm">Удалить</button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function setEquityChartType(type) {
    _equityChartType = type;
    renderEquityChart();
}

// Привязка через addEventListener на canvas — работает и после создания графика
function _attachForecastClickListener(chart, type) {
    const canvas = chart.canvas;
    if (!canvas) return;
    // Снимаем предыдущий обработчик если был
    if (canvas._forecastClickHandler) {
        canvas.removeEventListener('click', canvas._forecastClickHandler);
        canvas.removeEventListener('mousemove', canvas._forecastMoveHandler);
    }
    canvas._forecastClickHandler = (e) => {
        const pts = chart.getElementsAtEventForMode(e, 'nearest', { intersect: true }, false);
        if (!pts.length) return;
        const ds = chart.data.datasets[pts[0].datasetIndex];
        if (ds && ds.label === 'Прогноз →') openForecastDetail(type);
    };
    canvas._forecastMoveHandler = (e) => {
        const pts = chart.getElementsAtEventForMode(e, 'nearest', { intersect: true }, false);
        const hit = pts.some(el => {
            const ds = chart.data.datasets[el.datasetIndex];
            return ds && ds.label === 'Прогноз →';
        });
        canvas.style.cursor = hit ? 'pointer' : 'default';
    };
    canvas.addEventListener('click', canvas._forecastClickHandler);
    canvas.addEventListener('mousemove', canvas._forecastMoveHandler);
}

// Вспомогательная функция: добавить onClick + cursor для прогнозных точек
function _addForecastClickOptions(options, type) {
    // Увеличиваем зону попадания для треугольников
    if (!options.elements) options.elements = {};
    options.elements.point = { hitRadius: 18 };

    options.onClick = (evt, elements) => {
        if (!elements.length) return;
        // Ищем среди всех попавших под клик элементов датасет "Прогноз →"
        const chart = evt.chart;
        const hit = elements.find(el => {
            const ds = chart.data.datasets[el.datasetIndex];
            return ds && ds.label === 'Прогноз →';
        });
        if (hit) openForecastDetail(type);
    };
    options.onHover = (evt, elements) => {
        if (!evt.native) return;
        const chart = evt.chart;
        const isForecast = elements.some(el => {
            const ds = chart.data.datasets[el.datasetIndex];
            return ds && ds.label === 'Прогноз →';
        });
        evt.native.target.style.cursor = isForecast ? 'pointer' : 'default';
    };
    return options;
}

// ── Единая функция для НДК и НКЛ — лин./лог. шкала + тренд + прогноз ────────
function buildScaleChart(metricType, scaleType) {
    const isNkd = metricType === 'nkd';

    // Обновить переменную состояния
    if (isNkd) _nkdScaleType = scaleType; else _nklScaleType = scaleType;

    // Стили кнопок
    const btnLin = document.getElementById(`${isNkd ? 'nkd' : 'nkl'}-scale-linear`);
    const btnLog = document.getElementById(`${isNkd ? 'nkd' : 'nkl'}-scale-log`);
    if (btnLin && btnLog) {
        const active   = 'background:var(--bg-nav,#4B4240);color:white;border-color:var(--accent,#D9A86E);';
        const inactive = 'background:transparent;color:var(--text-secondary,#7D7471);border-color:var(--border,#A69C97);';
        btnLin.style.cssText = scaleType === 'linear' ? active : inactive;
        btnLog.style.cssText = scaleType === 'log'    ? active : inactive;
    }

    const records  = (db.financials?.records || []).sort((a,b) => new Date(a.date) - new Date(b.date));
    const mins     = db.financials?.mins || {};
    const minVal   = mins[metricType] ?? (isNkd ? 8 : 100);
    const recs     = records.filter(r => r.type === metricType);
    const dates    = recs.map(r => r.date);
    const values   = recs.map(r => r.value);
    const isLog    = scaleType === 'log';
    const allVals  = values.filter(v => v !== null && !isNaN(v) && v > 0);

    // Цвета — яркие чтобы были видны и в тёмной теме
    const dataColor    = isNkd ? '#D9A86E' : '#5B9BD5';   // НДК — золотой, НКЛ — синий
    const trendColor   = isNkd ? '#FF8C42' : '#00D4AA';   // тренд: НДК — оранжевый, НКЛ — бирюзовый
    const canvasId     = isNkd ? 'financialsNkdChart' : 'financialsNklChart';
    const chartVarName = isNkd ? 'financialsNkdChart'     : 'financialsNklChart';
    const axisLabel    = isNkd ? 'НДК, % (лог. шкала)'   : 'НКЛ, % (лог. шкала)';
    const dataLabel    = isNkd ? 'НДК (%)' : 'НКЛ (%)';

    const yAxisConfig = isLog ? {
        type: 'logarithmic',
        title: { display: true, text: axisLabel, color: '#7D7471', font: { size: 11 } },
        min: Math.min(minVal * 0.5, allVals.length ? Math.min(...allVals) * 0.8 : minVal * 0.5),
        ticks: {
            callback: v => (Number.isInteger(Math.log10(v)) ||
                [1,2,5,10,20,50,100,200,500,1000,2000,5000,10000].includes(v)) ? v + '%' : null,
            color: '#7D7471', maxTicksLimit: 8
        },
        grid: { color: 'rgba(200,200,200,0.3)' }
    } : {
        type: 'linear',
        min: (() => {
            const dataMin = allVals.length ? Math.min(...allVals) : minVal;
            return Math.min(minVal * 0.85, dataMin * 0.9);
        })(),
        ticks: { callback: v => v + '%', color: '#7D7471' },
        grid: { color: 'rgba(200,200,200,0.3)' }
    };

    const ctx = document.getElementById(canvasId)?.getContext('2d');
    if (!ctx) return;

    // Разрушить старый
    if (isNkd) { if (financialsNkdChart) financialsNkdChart.destroy(); }
    else        { if (financialsNklChart) financialsNklChart.destroy(); }

    // Строим тренд + прогноз сразу (не через setTimeout)
    let allDates = dates;
    let trendDataset = null, forecastDataset = null;

    if (values.length >= 2) {
        const result = buildEWMADatasets(dates, values, minVal, trendColor, metricType);
        if (result) {
            allDates = result.allDates;
            // Тренд (Холт) — яркий пунктир
            trendDataset = {
                ...result.datasets[0],
                borderColor: trendColor,
                borderWidth: 2.5,
            };
            // Прогноз → треугольники
            const fv = result.forecastVals;
            const { redLine, yellowLine } = getZoneThresholds(metricType, minVal);
            const last = fv[fv.length - 1];
            const fColor = last < minVal ? '#ef4444'
                : last < redLine    ? '#ef4444'
                : last < yellowLine ? '#f59e0b' : '#22c55e';
            forecastDataset = {
                ...result.datasets[1],
                borderColor: fColor,
                borderWidth: 2.5,
                pointRadius: [...Array(dates.length).fill(0), ...Array(3).fill(8)],
                pointBackgroundColor: fColor,
            };
        }
    }

    // Дополняем исторические серии null-ами если allDates длиннее
    const padTo = allDates.length;
    const padArr = arr => [...(arr||[]), ...Array(Math.max(0, padTo - (arr?.length||0))).fill(null)];

    const baseDatasets = [
        {
            label: dataLabel,
            data: padArr(values),
            borderColor: dataColor,
            backgroundColor: isLog ? 'transparent' : (isNkd ? 'rgba(217,168,110,0.12)' : 'rgba(91,155,213,0.10)'),
            tension: 0.3,
            fill: !isLog,
            pointBackgroundColor: dataColor,
            pointRadius: 5,
            spanGaps: true,
            order: 3
        },
        {
            label: `Минимум (${minVal}%)`,
            data: Array(padTo).fill(minVal),
            borderColor: '#ef4444',
            borderDash: [8, 4],
            borderWidth: 2.5,
            pointRadius: 0,
            fill: false,
            order: 1
        }
    ];

    const datasets = [
        ...baseDatasets,
        ...(trendDataset   ? [trendDataset]   : []),
        ...(forecastDataset ? [forecastDataset] : []),
    ];

    const _scaleOpts = _addForecastClickOptions({
        maintainAspectRatio: false, responsive: true,
        plugins: { legend: _legendOpts() },
        scales: {
            y: yAxisConfig,
            x: { ticks: { color: '#7D7471', maxTicksLimit: 10 }, grid: { display: false } }
        }
    }, metricType);

    const chart = new Chart(ctx, {
        type: 'line',
        data: { labels: allDates, datasets },
        options: _scaleOpts
    });

    if (isNkd) financialsNkdChart = chart;
    else       financialsNklChart = chart;

    // Привязать клик через canvas listener
    _attachForecastClickListener(chart, metricType);
}

function setNkdScale(type) { buildScaleChart('nkd', type); }
function setNklScale(type) { buildScaleChart('nkl', type); }


function saveFinRecord() {
    const date = document.getElementById('fin-date').value;
    const type = document.getElementById('fin-type').value;
    const valueRaw = document.getElementById('fin-value').value;
    const comment = document.getElementById('fin-comment').value;

    if (!date || valueRaw === '') {
        alert('Укажите дату и значение показателя!');
        return;
    }
    const value = parseFloat(valueRaw);
    if (isNaN(value)) {
        alert('Значение должно быть числом.');
        return;
    }

    if (!db.financials) db.financials = { records: [], mins: { nkd: 100, nkl: 100, equity: 3000 } };
    if (!db.financials.records) db.financials.records = [];

    const newRec = {
        id: Date.now(),
        date, type, value, comment
    };
    db.financials.records.push(newRec);
    localStorage.setItem('controllerDataV3', JSON.stringify(db));

    // Очистка
    document.getElementById('fin-value').value = '';
    document.getElementById('fin-comment').value = '';

    renderFinCards();
    renderFinCharts();
    renderFinTable();
}

function saveFinMins() {
    if (!db.financials) db.financials = { records: [], mins: {}, zones: {} };
    if (!db.financials.zones) db.financials.zones = {};

    db.financials.mins = {
        nkd:    parseFloat(document.getElementById('fin-min-nkd').value)    || 8,
        nkl:    parseFloat(document.getElementById('fin-min-nkl').value)    || 100,
        equity: parseFloat(document.getElementById('fin-min-equity').value) || 15000000,
    };

    // Per-metric zone thresholds
    ['nkd', 'nkl', 'equity'].forEach(type => {
        const yEl = document.getElementById(`fin-zone-${type}-yellow`);
        const rEl = document.getElementById(`fin-zone-${type}-red`);
        if (yEl) db.financials.zones[type + '_yellow'] = parseFloat(yEl.value) || ZONE_DEFAULTS[type].yellow;
        if (rEl) db.financials.zones[type + '_red']    = parseFloat(rEl.value) || ZONE_DEFAULTS[type].red;
    });

    saveDb();
    renderFinCards();
    renderFinCharts();
    renderFinTable();
    renderFinWarnings();
    alert('Настройки сохранены!');
}

function deleteFinRecord(id) {
    if (!confirm('Удалить эту запись?')) return;
    db.financials.records = db.financials.records.filter(r => r.id !== id);
    localStorage.setItem('controllerDataV3', JSON.stringify(db));
    renderFinCards();
    renderFinCharts();
    renderFinTable();
}

async function exportFinToExcel() {
    const records = db.financials?.records || [];
    if (records.length === 0) {
        alert('Нет данных для выгрузки');
        return;
    }
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Финансовые показатели');
    sheet.columns = [
        { header: 'Дата', key: 'date', width: 14 },
        { header: 'Показатель', key: 'type', width: 24 },
        { header: 'Фактическое значение', key: 'value', width: 22 },
        { header: 'Минимум', key: 'min', width: 18 },
        { header: 'Ед. изм.', key: 'unit', width: 14 },
        { header: 'Статус', key: 'status', width: 20 },
        { header: 'Комментарий', key: 'comment', width: 35 }
    ];
    const headerRow = sheet.getRow(1);
    headerRow.eachCell(cell => {
        cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4B4240' } };
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
    });
    records.sort((a,b) => new Date(b.date) - new Date(a.date)).forEach(rec => {
        const min = db.financials?.mins?.[rec.type] ?? '—';
        const status = getFinStatus(rec.type, rec.value);
        const row = sheet.addRow({
            date: rec.date,
            type: FIN_LABELS[rec.type] || rec.type,
            value: rec.value,
            min: min,
            unit: FIN_UNITS[rec.type] || '',
            status: status.label,
            comment: rec.comment || ''
        });
        const statusCell = row.getCell('status');
        if (status.ok === true) statusCell.font = { color: { argb: 'FF166534' }, bold: true };
        else if (status.ok === false) statusCell.font = { color: { argb: 'FFB91C1C' }, bold: true };
        else if (status.ok === 'warn') statusCell.font = { color: { argb: 'FF92400E' }, bold: true };
        row.eachCell({ includeEmpty: true }, cell => {
            cell.border = { top: {style:'thin'}, left: {style:'thin'}, bottom: {style:'thin'}, right: {style:'thin'} };
            cell.alignment = { vertical: 'top', wrapText: true };
        });
    });
    const buffer = await workbook.xlsx.writeBuffer();
    saveAs(new Blob([buffer]), `Financial_Metrics_${new Date().toISOString().split('T')[0]}.xlsx`);
}

// Инициализация финансового раздела при переходе на него обрабатывается в window.onload

// =============================================
// ============================================================
// EWMA + ДОВЕРИТЕЛЬНЫЙ ИНТЕРВАЛ + СВЕТОФОРНЫЕ ЗОНЫ
// Методология: RiskMetrics EWMA (α=0.85) + коридор ±1σ
// Прогноз на 3 точки вперёд с предупреждением о пробое минимума
// ============================================================

// ── Зоны по каждому нормативу отдельно ─────────────────────────────────────
// Дефолты: НДК 150%/120%, НКЛ 200%/150%, equity 130%/115%
const ZONE_DEFAULTS = {
    nkd:    { yellow: 150, red: 120 },
    nkl:    { yellow: 200, red: 150 },
    equity: { yellow: 130, red: 115 },
};

// Цвет текста легенды Chart.js — адаптируется к тёмной/светлой теме
function _legendColor() {
    return document.documentElement.classList.contains('dark') ? '#E0D9D4' : '#4B4240';
}
// Общие опции легенды — переиспользуем везде
function _legendOpts() {
    return {
        position: 'bottom',
        labels: {
            boxWidth: 12,
            font: { size: 11 },
            color: _legendColor(),
            filter: item => !item.text.startsWith('_zone'),
        },
        onClick(e, legendItem, legend) {
            const idx = legendItem.datasetIndex;
            const ci = legend.chart;
            if (ci.isDatasetVisible(idx)) { ci.hide(idx); legendItem.hidden = true; }
            else { ci.show(idx); legendItem.hidden = false; }
        }
    };
}

function getZoneThresholds(type, minVal) {
    const z = db.financials?.zones || {};
    const key = type; // 'nkd' | 'nkl' | 'equity'
    const yellow = z[key + '_yellow'] ?? ZONE_DEFAULTS[key]?.yellow ?? 120;
    const red    = z[key + '_red']    ?? ZONE_DEFAULTS[key]?.red    ?? 110;
    return {
        yellowLine: minVal * (yellow / 100),
        redLine:    minVal * (red    / 100),
    };
}

// Заглушка совместимости — вдруг кто-то вызывает setFinZoneMode
function setFinZoneMode(mode) { /* no-op, режим всегда pct per-metric */ }

// ═══════════════════════════════════════════════════════════════════════
// МЕТОД ХОЛТА (Double EWMA) с защитой от выбросов
// Выбросы в начале серии (напр. аномально высокие значения) исключаются
// из расчёта тренда — используется только «актуальное окно» данных.
// α — сглаживание уровня, β — сглаживание тренда
// ═══════════════════════════════════════════════════════════════════════

// Фильтрация выбросов: точки > 10× медианы считаются аномалией
// Возвращает индексы «чистых» точек
function _detectOutliers(values) {
    if (values.length < 3) return values.map((_, i) => i);
    const sorted = [...values].sort((a, b) => a - b);
    const med = sorted[Math.floor(sorted.length / 2)];
    const threshold = Math.max(med * 10, med + 1); // защита от нулевой медианы
    const clean = values.map((v, i) => i).filter(i => values[i] <= threshold);
    // Не отбрасываем если чистых < 3 — возвращаем все
    return clean.length >= 3 ? clean : values.map((_, i) => i);
}

function calcHolt(values, alpha = 0.4, beta = 0.3) {
    if (values.length === 0) return { levels: [], slopes: [], cleanIndices: [] };

    // Работаем на «чистых» точках, прогноз строим от их последнего уровня
    const cleanIdx = _detectOutliers(values);
    const cv = cleanIdx.map(i => values[i]);

    // Инициализация: наклон = 0 (безопасно для волатильных рядов)
    const cLevels = [cv[0]];
    const cSlopes = [0];
    for (let i = 1; i < cv.length; i++) {
        const prevL = cLevels[i - 1], prevS = cSlopes[i - 1];
        const l = alpha * cv[i] + (1 - alpha) * (prevL + prevS);
        const s = beta  * (l - prevL) + (1 - beta) * prevS;
        cLevels.push(l);
        cSlopes.push(s);
    }

    // Разворачиваем обратно в полный массив (выбросы = null)
    const levels = Array(values.length).fill(null);
    const slopes = Array(values.length).fill(null);
    cleanIdx.forEach((origI, ci) => {
        levels[origI] = cLevels[ci];
        slopes[origI] = cSlopes[ci];
    });

    return { levels, slopes, cleanIndices: cleanIdx };
}

// Прогноз Холта на steps шагов вперёд
function forecastHolt(levels, slopes, steps, lastDate, dates) {
    // Берём последний НЕ-null уровень
    let L = null, S = null;
    for (let i = levels.length - 1; i >= 0; i--) {
        if (levels[i] !== null) { L = levels[i]; S = slopes[i]; break; }
    }
    if (L === null) return { forecastDates: [], forecastVals: [] };

    const avgStep = dates.length > 1
        ? (new Date(dates[dates.length - 1]) - new Date(dates[0])) / (dates.length - 1)
        : 30 * 24 * 3600 * 1000;

    const forecastDates = [], forecastVals = [];
    // Прогноз всегда на последний день месяца: берём месяц lastDate + h месяцев
    const _lastD = new Date(lastDate);
    for (let h = 1; h <= steps; h++) {
        // Последний день (lastDate.month + h)-го месяца
        const endOfMonth = new Date(_lastD.getFullYear(), _lastD.getMonth() + h + 1, 0);
        forecastDates.push(_localDateStr(endOfMonth));
        forecastVals.push(Math.max(0, L + h * S));
    }
    return { forecastDates, forecastVals };
}

// Стандартное отклонение остатков (только по чистым точкам)
function calcResidualStd(values, levels) {
    const pairs = values.map((v, i) => [v, levels[i]])
        .filter(([v, l]) => l !== null && v !== null && !isNaN(v) && !isNaN(l));
    if (pairs.length < 2) return 0;
    const residuals = pairs.map(([v, l]) => v - l);
    const mean = residuals.reduce((a, b) => a + b, 0) / residuals.length;
    const variance = residuals.reduce((s, r) => s + (r - mean) ** 2, 0) / (residuals.length - 1);
    return Math.sqrt(variance);
}

// Через сколько шагов ПРОГНОЗ Холта пробьёт минимум
function calcStepsToBreak(levels, slopes, minVal, forecastVals, steps = 10) {
    // Берём последний ненулевой уровень и наклон
    let L = null, S = null;
    for (let i = levels.length - 1; i >= 0; i--) {
        if (levels[i] !== null) { L = levels[i]; S = slopes[i]; break; }
    }
    if (L === null || S === null || S >= 0) return null;
    for (let h = 1; h <= steps; h++) {
        if (L + h * S <= minVal) return h;
    }
    return null;
}

// Обратная совместимость: старый calcEWMA используется в addTrendDataset
function calcEWMA(values, alpha = 0.3) {
    // Переключаем на уровень Холта (без наклона) для обратной совместимости
    const { levels } = calcHolt(values, alpha, 0.1);
    return levels;
}

// Главная функция: Holt datasets для Chart.js
function buildEWMADatasets(dates, values, minVal, color, type) {
    if (values.length < 2) return null;

    const { levels, slopes } = calcHolt(values, 0.4, 0.3);
    const std = calcResidualStd(values, levels);
    const FORECAST_STEPS = 3;
    const lastDate = dates[dates.length - 1];

    const { forecastDates, forecastVals } =
        forecastHolt(levels, slopes, FORECAST_STEPS, lastDate, dates);

    const allDates = [...dates, ...forecastDates];

    // Цвет прогнозной линии по зоне
    const { redLine, yellowLine } = getZoneThresholds(type, minVal);
    const forecastLast = forecastVals.length ? forecastVals[forecastVals.length - 1] : minVal * 2;
    let forecastColor = '#22c55e';
    if (forecastLast < minVal)          forecastColor = '#ef4444';
    else if (forecastLast < redLine)    forecastColor = '#ef4444';
    else if (forecastLast < yellowLine) forecastColor = '#f59e0b';

    const frontPad = (arr, n) => [...Array(n).fill(null), ...arr];
    const stepsToBreak = calcStepsToBreak(levels, slopes, minVal, forecastVals);

    // levels может содержать null для выбросов — spanGaps их пропустит
    return {
        allDates,
        levels,
        slopes,
        std,
        forecastVals,
        stepsToBreak,
        datasets: [
            // Линия тренда Холта
            {
                label: 'Тренд (Холт)',
                data: [...levels, ...Array(FORECAST_STEPS).fill(null)],
                borderColor: color,
                borderWidth: 2.2,
                borderDash: [4, 3],
                pointRadius: 0,
                fill: false,
                tension: 0.3,
                spanGaps: true,   // пропускаем null (выбросы)
                order: 2
            },
            // Прогнозные точки-треугольники
            {
                label: 'Прогноз →',
                data: frontPad(forecastVals, dates.length),
                borderColor: forecastColor,
                borderWidth: 2.5,
                borderDash: [6, 3],
                pointRadius: [...Array(dates.length).fill(0), ...Array(FORECAST_STEPS).fill(8)],
                pointStyle: 'triangle',
                pointBackgroundColor: forecastColor,
                fill: false,
                tension: 0,
                order: 1
            }
        ]
    };
}

// Цветные зоны фона на графике через горизонтальные dataset-полосы
function buildZoneBgDatasets(allDates, minVal, zoneType) {
    const { redLine, yellowLine } = getZoneThresholds(zoneType, minVal);
    const n = allDates.length;
    // Chart.js fill между двумя dataset-ами через индекс работает ненадёжно.
    // Используем три отдельных dataset с fill к фиксированным значениям:
    // 1. Нарушение: от minVal вниз (заливка ниже минимума)
    // 2. Красная зона: от minVal до redLine
    // 3. Жёлтая зона: от redLine до yellowLine
    return [
        // Нарушение норматива — тёмно-красный фон НИЖЕ минимума
        {
            label: '_zone_breach',
            data: Array(n).fill(minVal),
            borderColor: 'transparent',
            backgroundColor: 'rgba(185,28,28,0.10)',
            fill: { target: 'origin', above: 'transparent', below: 'rgba(185,28,28,0.10)' },
            pointRadius: 0,
            borderWidth: 0,
            tension: 0,
            order: 22
        },
        // Красная зона: minVal → redLine
        {
            label: '_zone_red',
            data: Array(n).fill(redLine),
            borderColor: 'transparent',
            backgroundColor: 'transparent',
            fill: { target: { value: minVal }, above: 'rgba(239,68,68,0.09)', below: 'transparent' },
            pointRadius: 0,
            borderWidth: 0,
            tension: 0,
            order: 21
        },
        // Жёлтая зона: redLine → yellowLine (пунктирная граница)
        {
            label: '_zone_yellow',
            data: Array(n).fill(yellowLine),
            borderColor: 'rgba(245,158,11,0.55)',
            borderWidth: 1.5,
            borderDash: [5, 5],
            backgroundColor: 'transparent',
            fill: { target: { value: redLine }, above: 'rgba(245,158,11,0.06)', below: 'transparent' },
            pointRadius: 0,
            tension: 0,
            order: 20
        }
    ];
}

// Блок предупреждений — главный сигнал: через N периодов пробьём минимум
function renderFinWarnings() {
    const container = document.getElementById('fin-warnings');
    if (!container) return;

    const records = db.financials?.records || [];
    const mins    = db.financials?.mins    || {};
    const warnings = [];
    const oks      = [];

    ['nkd', 'nkl', 'equity'].forEach(type => {
        const recs = records.filter(r => r.type === type)
            .sort((a, b) => new Date(a.date) - new Date(b.date));
        if (recs.length < 2) return;

        const values  = recs.map(r => r.value);
        const minVal  = mins[type] ?? 0;
        const { levels, slopes } = calcHolt(values, 0.3, 0.2);
        const currentLevel = levels[levels.length - 1];   // текущий сглаженный уровень
        const currentSlope = slopes[slopes.length - 1];   // текущий наклон тренда
        const lastActual   = values[values.length - 1];   // последнее фактическое значение
        const { redLine, yellowLine } = getZoneThresholds(type, minVal);
        const label  = FIN_LABELS[type];
        const suffix = FIN_UNITS[type] === '%' ? '%' : '';

        // Буфер — от последнего фактического значения, не от EWMA
        const buf = minVal > 0 ? ((lastActual / minVal - 1) * 100).toFixed(1) : '—';

        // stepsToBreak — только если тренд нисходящий
        const stepsToBreak = calcStepsToBreak(levels, slopes, minVal, []);

        // Направление тренда (в % от текущего уровня)
        const trendPct = currentLevel > 0
            ? ((currentSlope / currentLevel) * 100).toFixed(1)
            : '0';
        const trendStr = currentSlope > 0.001 * currentLevel
            ? `↑ +${trendPct}%/пер`
            : currentSlope < -0.001 * currentLevel
                ? `↓ ${trendPct}%/пер`
                : '→ стабильно';

        if (lastActual < minVal) {
            warnings.push({
                level: 'red',
                text: `⛔ <b>${label}</b>: НИЖЕ минимума! (${lastActual.toLocaleString('ru-RU', {maximumFractionDigits:1})}${suffix} &lt; ${minVal.toLocaleString('ru-RU')}${suffix}). Немедленные меры.`
            });
        } else if (stepsToBreak !== null && stepsToBreak <= 3) {
            warnings.push({
                level: 'red',
                text: `🚨 <b>${label}</b>: тренд нисходящий (${trendStr}), при сохранении — пробой через <b>~${stepsToBreak} пер.</b> Буфер факт.: ${buf}%.`
            });
        } else if (lastActual < redLine) {
            const redBuf = ((lastActual / minVal - 1) * 100).toFixed(1);
            warnings.push({
                level: 'red',
                text: `🔴 <b>${label}</b>: красная зона. Буфер: ${redBuf}%. Тренд: ${trendStr}.`
            });
        } else if (lastActual < yellowLine) {
            warnings.push({
                level: 'yellow',
                text: `⚠️ <b>${label}</b>: жёлтая зона. Буфер: ${buf}%. Тренд: ${trendStr}.`
            });
        } else {
            const trend = currentSlope < -0.01 * currentLevel
                ? ` — тренд нисходящий (${trendStr}), следите за динамикой`
                : `, тренд: ${trendStr}`;
            oks.push(`✅ ${label}: буфер ${buf}%${trend}`);
        }
    });

    if (warnings.length === 0 && oks.length === 0) {
        container.innerHTML = '<div class="text-sm text-[#A69C97] italic">Недостаточно данных для прогноза (нужно ≥2 записей на норматив).</div>';
        return;
    }

    const warnHtml = warnings.map(w => `
        <div class="flex items-start gap-2 ${w.level === 'red'
            ? 'bg-red-50 border-red-200 text-red-800'
            : 'bg-yellow-50 border-yellow-200 text-yellow-800'} border rounded-lg px-4 py-3 text-sm leading-snug">
            ${w.text}
        </div>`).join('');

    const okHtml = oks.length > 0
        ? `<div class="flex flex-wrap gap-3 mt-1">${oks.map(t =>
            `<span class="text-xs text-green-700 bg-green-50 border border-green-200 rounded px-3 py-1">${t}</span>`
          ).join('')}</div>`
        : '';

    container.innerHTML = warnHtml + okHtml;
}

// addTrendDataset — обратная совместимость (используется в setNkdScale/setNklScale)
function addTrendDataset(dates, values, label, color) {
    if (values.length < 2) return null;
    const { levels, slopes } = calcHolt(values, 0.3, 0.2);
    const lastDate = dates[dates.length - 1];
    const avgStep = dates.length > 1
        ? (new Date(dates[dates.length - 1]) - new Date(dates[0])) / (dates.length - 1)
        : 30 * 24 * 3600 * 1000;
    const STEPS = 3;
    const L = levels[levels.length - 1];
    const S = slopes[slopes.length - 1];
    const _lastDateD = new Date(lastDate);
    const extraDates = Array.from({length: STEPS}, (_, i) => {
        const endOfMonth = new Date(_lastDateD.getFullYear(), _lastDateD.getMonth() + i + 2, 0);
        return _localDateStr(endOfMonth);
    });
    const allDates  = [...dates, ...extraDates];
    // Прогноз с наклоном — не горизонталь
    const forecast  = Array.from({length: STEPS}, (_, i) => Math.max(0, L + (i + 1) * S));
    const trendData = [...levels, ...forecast];

    return {
        allDates,
        dataset: {
            label: 'Тренд (Холт)',
            data: trendData,
            borderColor: color,
            borderDash: [4, 4],
            borderWidth: 1.8,
            pointRadius: allDates.map((_, i) => i >= dates.length ? 5 : 0),
            pointStyle: 'triangle',
            fill: false,
            tension: 0.2,
            order: 3
        }
    };
}

// Патч renderFinCharts — добавляем EWMA + зоны фона + предупреждения
const _origRenderFinCharts = renderFinCharts;
renderFinCharts = function() {
    _origRenderFinCharts();
    setTimeout(() => {
        const records = (db.financials?.records || []).sort((a, b) => new Date(a.date) - new Date(b.date));
        const mins = db.financials?.mins || {};

        ['nkd', 'nkl'].forEach(type => {
            const chartRef = type === 'nkd' ? financialsNkdChart : financialsNklChart;
            if (!chartRef) return;
            const recs = records.filter(r => r.type === type);
            if (recs.length < 2) return;

            const dates  = recs.map(r => r.date);
            const values = recs.map(r => r.value);
            const minVal = mins[type] ?? 100;
            const color  = type === 'nkd' ? '#D9A86E' : '#4B4240';

            const result = buildEWMADatasets(dates, values, minVal, color, type);
            if (!result) return;

            // Расширяем labels до прогнозного горизонта
            chartRef.data.labels = result.allDates;

            // Дополнить существующие data-серии null-ами
            chartRef.data.datasets.forEach(ds => {
                if (ds.label && (ds.label.startsWith('_zone') || ds.label === 'Тренд (EWMA)' ||
                    ds.label === 'Прогноз' || ds.label === 'Тренд')) return;
                const extra = result.allDates.length - (ds.data?.length || 0);
                if (extra > 0) ds.data = [...(ds.data || []), ...Array(extra).fill(null)];
            });

            // Убрать старые EWMA/прогноз/зоны
            chartRef.data.datasets = chartRef.data.datasets.filter(d =>
                !d.label || (!d.label.startsWith('_zone') && d.label !== 'Тренд (EWMA)' &&
                d.label !== 'Прогноз →' && d.label !== 'Тренд' &&
                !d.label.startsWith('Коридор'))
            );

            // Добавить зоны фона (в начало, чтобы быть за данными)
            const zoneBg = buildZoneBgDatasets(result.allDates, minVal, type);
            chartRef.data.datasets = [...zoneBg, ...chartRef.data.datasets, ...result.datasets];
            chartRef.update();
            // Повесить click на canvas через addEventListener (работает после update)
            _attachForecastClickListener(chartRef, type);
        });

        renderFinWarnings();
        // Обновить график собственных средств (EWMA + предупреждения)
        if (_equityChartType === 'line') renderEquityChart();
    }, 100);
};


// ═══════════════════════════════════════════════════════════════════════════
// МОДУЛЬ ДЕТАЛЬНОГО РАСЧЁТА ПРОГНОЗА
// openForecastDetail(type)   — открыть панель для 'nkd'/'nkl'/'equity'
// closeForecastDetail()      — вернуться к разделу финансовых показателей
// _renderForecastDetail(…)   — заполнить все блоки панели
// ═══════════════════════════════════════════════════════════════════════════

// Текущий открытый тип (для обновления при смене данных)
let _fcdCurrentType = null;

function openForecastDetail(type) {
    _fcdCurrentType = type;

    // Используем ту же систему что и навигация — класс active
    document.querySelectorAll('.content-section').forEach(s => s.classList.remove('active'));
    document.querySelectorAll('.nav-link').forEach(nl => nl.classList.remove('active'));
    const panel = document.getElementById('section-forecast-detail');
    panel.classList.add('active');

    _renderForecastDetail(type);

    window.scrollTo({ top: 0 });
}

function closeForecastDetail() {
    // Возвращаемся к финансовым показателям
    document.querySelectorAll('.content-section').forEach(s => s.classList.remove('active'));
    document.getElementById('section-financials').classList.add('active');
    // Активируем нужный nav-link
    const navLink = document.querySelector('.nav-link[data-target="section-financials"]');
    if (navLink) {
        document.querySelectorAll('.nav-link').forEach(nl => nl.classList.remove('active'));
        navLink.classList.add('active');
    }
    _fcdCurrentType = null;
}

function _renderForecastDetail(type) {
    const records = (db.financials?.records || [])
        .filter(r => r.type === type)
        .sort((a, b) => new Date(a.date) - new Date(b.date));

    const mins    = db.financials?.mins || {};
    const minVal  = mins[type] ?? (type === 'nkd' ? 8 : type === 'nkl' ? 100 : 15000000);
    const label   = FIN_LABELS[type] || type;
    const suffix  = FIN_UNITS[type] === '%' ? '%' : '';
    const fmt     = v => v === null ? '—' : v.toLocaleString('ru-RU', { maximumFractionDigits: 2 }) + suffix;
    const fmtN    = v => v === null ? '—' : v.toLocaleString('ru-RU', { maximumFractionDigits: 2 });

    document.getElementById('fcd-title').textContent = `Расчёт прогноза — ${label}`;

    if (records.length < 2) {
        ['fcd-cards','fcd-method','fcd-steps','fcd-table-body','fcd-forecast-cards','fcd-interpretation']
            .forEach(id => {
                const el = document.getElementById(id);
                if (el) el.innerHTML = '<p class="text-sm text-[#A69C97] italic col-span-4">Недостаточно данных (нужно ≥ 2 записей).</p>';
            });
        return;
    }

    const values = records.map(r => r.value);
    const dates  = records.map(r => r.date);
    const alpha  = 0.4, beta = 0.3;

    // ── Расчёт Холта ──────────────────────────────────────────────────────
    const cleanIdx = _detectOutliers(values);
    const isClean  = values.map((_, i) => cleanIdx.includes(i));
    const cv       = cleanIdx.map(i => values[i]);

    // Итерации
    const cLevels = [cv[0]], cSlopes = [0];
    for (let i = 1; i < cv.length; i++) {
        const pL = cLevels[i-1], pS = cSlopes[i-1];
        const l  = alpha * cv[i] + (1 - alpha) * (pL + pS);
        const s  = beta  * (l - pL) + (1 - beta) * pS;
        cLevels.push(l); cSlopes.push(s);
    }

    // Разворачиваем в полный массив (выбросы = null)
    const levels = Array(values.length).fill(null);
    const slopes = Array(values.length).fill(null);
    let ci = 0;
    cleanIdx.forEach(origI => { levels[origI] = cLevels[ci]; slopes[origI] = cSlopes[ci]; ci++; });

    // Последние ненулевые
    let lastL = null, lastS = null;
    for (let i = levels.length - 1; i >= 0; i--) {
        if (levels[i] !== null) { lastL = levels[i]; lastS = slopes[i]; break; }
    }

    // Прогноз на 3 шага — всегда на последний день h-го следующего месяца
    const STEPS = 3;
    const _lastForecastD = new Date(dates[dates.length - 1]);
    const forecastDates = [], forecastVals = [];
    for (let h = 1; h <= STEPS; h++) {
        const endOfMonth = new Date(_lastForecastD.getFullYear(), _lastForecastD.getMonth() + h + 1, 0);
        forecastDates.push(_localDateStr(endOfMonth));
        forecastVals.push(Math.max(0, lastL + h * lastS));
    }

    // Остатки и σ
    const residuals = cleanIdx.map((origI, ci) => values[origI] - cLevels[ci]);
    const meanRes   = residuals.reduce((a,b) => a+b, 0) / residuals.length;
    const sigma     = Math.sqrt(residuals.reduce((s,r) => s + (r-meanRes)**2, 0) / Math.max(residuals.length-1, 1));

    const { redLine, yellowLine } = getZoneThresholds(type, minVal);
    const lastActual = values[values.length - 1];
    const buffer     = minVal > 0 ? ((lastActual / minVal - 1) * 100).toFixed(1) : '—';
    const trendDir   = lastS > 0.001 * Math.abs(lastL) ? 'восходящий ↑'
                     : lastS < -0.001 * Math.abs(lastL) ? 'нисходящий ↓' : 'стабильный →';
    const trendPct   = lastL > 0 ? ((lastS / lastL) * 100).toFixed(2) : '0';
    const outliersN  = values.length - cleanIdx.length;

    // ── КАРТОЧКИ-РЕЗЮМЕ ──────────────────────────────────────────────────
    const cardColor = fc => fc < minVal ? 'border-red-400 bg-red-50 text-red-700'
        : fc < redLine    ? 'border-orange-400 bg-orange-50 text-orange-700'
        : fc < yellowLine ? 'border-yellow-400 bg-yellow-50 text-yellow-800'
        : 'border-green-400 bg-green-50 text-green-700';

    const lastFc = forecastVals[STEPS-1];

    document.getElementById('fcd-cards').innerHTML = [
        { label: 'Последнее факт.', val: fmt(lastActual), sub: `Дата: ${dates[dates.length-1]}`, cls: 'border-[#D9A86E] bg-[#FDF8F3]' },
        { label: 'Уровень тренда L', val: fmtN(lastL) + suffix, sub: 'Сглаженное значение', cls: 'border-[#5B9BD5] bg-blue-50' },
        { label: 'Наклон S / период', val: (lastS >= 0 ? '+' : '') + fmtN(lastS) + suffix, sub: trendDir + ` (${trendPct}%/пер)`, cls: lastS < 0 ? 'border-red-300 bg-red-50' : 'border-green-300 bg-green-50' },
        { label: `Прогноз +${STEPS} пер.`, val: fmt(lastFc), sub: forecastDates[STEPS-1], cls: cardColor(lastFc) },
    ].map(c => `
        <div class="rounded-xl border-2 ${c.cls} p-4">
            <p class="text-xs font-semibold uppercase tracking-wide opacity-70 mb-1">${c.label}</p>
            <p class="text-xl font-bold">${c.val}</p>
            <p class="text-xs opacity-60 mt-1">${c.sub}</p>
        </div>`).join('');

    // ── МЕТОДОЛОГИЯ ──────────────────────────────────────────────────────
    document.getElementById('fcd-method').innerHTML = `
        <div class="p-3 rounded-lg bg-[#F5F0EB] border border-[#E0D9D4]">
            <p class="font-semibold mb-1 text-[#D9A86E]">Метод Холта (двойное экспоненциальное сглаживание)</p>
            <p class="text-[#7D7471] leading-relaxed">Учитывает не только текущий уровень ряда, но и его тренд (наклон). В отличие от простого EWMA, прогноз не горизонтальный — он экстраполирует направление.</p>
        </div>

        <div>
            <p class="font-semibold mb-2">Формулы обновления:</p>
            <div class="space-y-2 font-mono text-xs bg-[#F5F0EB] rounded-lg p-3 border border-[#E0D9D4]">
                <p><span class="text-[#D9A86E] font-bold">Уровень:</span>  L<sub>t</sub> = α × y<sub>t</sub> + (1−α) × (L<sub>t-1</sub> + S<sub>t-1</sub>)</p>
                <p><span class="text-[#5B9BD5] font-bold">Наклон:  </span>  S<sub>t</sub> = β × (L<sub>t</sub> − L<sub>t-1</sub>) + (1−β) × S<sub>t-1</sub></p>
                <p><span class="text-green-600 font-bold">Прогноз: </span>  F(h) = L<sub>T</sub> + h × S<sub>T</sub></p>
            </div>
        </div>

        <div class="grid grid-cols-2 gap-3">
            <div class="p-3 rounded-lg bg-[#F5F0EB] border border-[#E0D9D4] text-center">
                <p class="text-xs text-[#7D7471]">Параметр α (уровень)</p>
                <p class="text-2xl font-bold text-[#D9A86E]">${alpha}</p>
                <p class="text-xs text-[#A69C97]">вес новых данных</p>
            </div>
            <div class="p-3 rounded-lg bg-[#F5F0EB] border border-[#E0D9D4] text-center">
                <p class="text-xs text-[#7D7471]">Параметр β (тренд)</p>
                <p class="text-2xl font-bold text-[#5B9BD5]">${beta}</p>
                <p class="text-xs text-[#A69C97]">вес изменения наклона</p>
            </div>
        </div>

        <div class="p-3 rounded-lg ${outliersN > 0 ? 'bg-yellow-50 border border-yellow-200' : 'bg-green-50 border border-green-200'}">
            <p class="font-semibold mb-1 ${outliersN > 0 ? 'text-yellow-700' : 'text-green-700'}">
                ${outliersN > 0 ? `⚠️ Обнаружено выбросов: ${outliersN}` : '✅ Выбросов не обнаружено'}
            </p>
            <p class="text-xs ${outliersN > 0 ? 'text-yellow-600' : 'text-green-600'} leading-relaxed">
                ${outliersN > 0
                    ? `Точки превышающие 10× медиану (${fmtN(Math.max(...values.filter((_,i)=>!isClean[i])))}${suffix}) исключены из расчёта тренда. Используется ${cleanIdx.length} из ${values.length} точек.`
                    : `Все ${values.length} точек включены в расчёт тренда.`}
            </p>
        </div>

        <div class="p-3 rounded-lg bg-[#F5F0EB] border border-[#E0D9D4]">
            <p class="font-semibold mb-1">Стандартное отклонение остатков (σ):</p>
            <p class="text-lg font-bold text-[#4B4240]">${fmtN(sigma)}${suffix}</p>
            <p class="text-xs text-[#A69C97]">Мера разброса факт. значений вокруг тренда. Чем меньше — тем стабильнее ряд.</p>
        </div>`;

    // ── ПОШАГОВЫЙ РАСЧЁТ ────────────────────────────────────────────────
    let stepsHtml = `
        <div class="p-3 rounded-lg bg-[#F5F0EB] border border-[#E0D9D4]">
            <p class="font-semibold text-[#4B4240]">Шаг 1. Инициализация</p>
            <p class="text-[#7D7471] mt-1">Начальный уровень L₀ = первая чистая точка = <span class="font-mono font-bold">${fmt(cv[0])}</span></p>
            <p class="text-[#7D7471]">Начальный наклон S₀ = <span class="font-mono font-bold">0</span> (безопасная инициализация для волатильных рядов)</p>
        </div>
        <div class="p-3 rounded-lg bg-[#F5F0EB] border border-[#E0D9D4]">
            <p class="font-semibold text-[#4B4240]">Шаг 2. Итерации Холта (${cv.length} точек)</p>
            <p class="text-[#7D7471] mt-1">Подробно — в таблице ниже. Финальные значения:</p>
            <p class="mt-2 font-mono text-xs bg-white rounded p-2 border border-[#E0D9D4]">
                L<sub>T</sub> = <b>${fmtN(lastL)}${suffix}</b><br>
                S<sub>T</sub> = <b>${lastS >= 0 ? '+' : ''}${fmtN(lastS)}${suffix}</b> / период
            </p>
        </div>
        <div class="p-3 rounded-lg bg-[#F5F0EB] border border-[#E0D9D4]">
            <p class="font-semibold text-[#4B4240]">Шаг 3. Прогноз F(h) = L + h × S</p>`;

    forecastVals.forEach((fv, i) => {
        const h = i + 1;
        const fc_color = fv < minVal ? 'text-red-600' : fv < redLine ? 'text-orange-500' : fv < yellowLine ? 'text-yellow-600' : 'text-green-600';
        stepsHtml += `
            <p class="font-mono text-xs mt-1 bg-white rounded px-2 py-1 border border-[#E0D9D4]">
                F(${h}) = ${fmtN(lastL)} + ${h} × ${lastS >= 0 ? '' : '('}${fmtN(lastS)}${lastS < 0 ? ')' : ''} = <span class="font-bold ${fc_color}">${fmt(fv)}</span>
                <span class="text-[#A69C97] ml-1">(${forecastDates[i]})</span>
            </p>`;
    });
    stepsHtml += `</div>
        <div class="p-3 rounded-lg bg-[#F5F0EB] border border-[#E0D9D4]">
            <p class="font-semibold text-[#4B4240]">Шаг 4. Буфер безопасности</p>
            <p class="font-mono text-xs mt-1 bg-white rounded px-2 py-1 border border-[#E0D9D4]">
                Буфер = (факт / минимум − 1) × 100%<br>
                = (${fmtN(lastActual)} / ${fmtN(minVal)} − 1) × 100% = <b>${buffer}%</b>
            </p>
        </div>`;

    document.getElementById('fcd-steps').innerHTML = stepsHtml;

    // ── ТАБЛИЦА ИТЕРАЦИЙ ─────────────────────────────────────────────────
    let ciCounter = 0;
    const tbody = document.getElementById('fcd-table-body');
    tbody.innerHTML = records.map((rec, i) => {
        const clean = isClean[i];
        const l = levels[i], s = slopes[i];
        const dev = (l !== null) ? rec.value - l : null;
        const devStr = dev !== null ? ((dev >= 0 ? '+' : '') + fmtN(dev) + suffix) : '—';
        const devColor = dev === null ? '' : Math.abs(dev) > sigma * 1.5 ? 'text-red-500' : Math.abs(dev) > sigma * 0.5 ? 'text-yellow-600' : 'text-green-600';
        const rowBg = !clean ? 'bg-yellow-50' : i % 2 === 0 ? '' : 'bg-[#FDFBF8]';

        // Показываем итерацию Холта для чистых точек
        let iterStr = '—';
        if (clean && ciCounter > 0) {
            const prevL = cLevels[ciCounter - 1], prevS = cSlopes[ciCounter - 1];
            iterStr = `α×${fmtN(rec.value)} + (1−α)×(${fmtN(prevL)}+${fmtN(prevS)})`;
        }
        if (clean) ciCounter++;

        return `<tr class="border-b border-[#E0D9D4] ${rowBg} hover:bg-blue-50 transition">
            <td class="p-3 font-semibold text-[#4B4240]">${rec.date}</td>
            <td class="p-3 text-right font-mono">${fmt(rec.value)}</td>
            <td class="p-3 text-center">${clean ? '<span class="text-green-600 font-bold">✓</span>' : '<span class="text-yellow-500 text-xs font-semibold">выброс</span>'}</td>
            <td class="p-3 text-right font-mono text-[#5B9BD5]">${l !== null ? fmtN(l) + suffix : '—'}</td>
            <td class="p-3 text-right font-mono ${lastS < 0 ? 'text-red-500' : 'text-green-600'}">${s !== null ? (s >= 0 ? '+' : '') + fmtN(s) + suffix : '—'}</td>
            <td class="p-3 text-right font-mono ${devColor}">${devStr}</td>
            <td class="p-3 text-center">
                ${rec.value < minVal
                    ? '<span class="px-2 py-0.5 rounded-full text-xs bg-red-100 text-red-700 font-bold">⛔ Нарушение</span>'
                    : rec.value < redLine
                        ? '<span class="px-2 py-0.5 rounded-full text-xs bg-orange-100 text-orange-700">🔴 Красная</span>'
                        : rec.value < yellowLine
                            ? '<span class="px-2 py-0.5 rounded-full text-xs bg-yellow-100 text-yellow-700">🟡 Жёлтая</span>'
                            : '<span class="px-2 py-0.5 rounded-full text-xs bg-green-100 text-green-700">✅ Норма</span>'}
            </td>
        </tr>`;
    }).join('');

    // ── ПРОГНОЗНЫЕ КАРТОЧКИ ──────────────────────────────────────────────
    document.getElementById('fcd-forecast-cards').innerHTML = forecastVals.map((fv, i) => {
        const h = i + 1;
        const cls = fv < minVal        ? 'border-red-400 bg-red-50'
                  : fv < redLine       ? 'border-orange-400 bg-orange-50'
                  : fv < yellowLine    ? 'border-yellow-400 bg-yellow-50'
                  : 'border-green-400 bg-green-50';
        const textCls = fv < minVal    ? 'text-red-700'
                  : fv < redLine       ? 'text-orange-700'
                  : fv < yellowLine    ? 'text-yellow-700'
                  : 'text-green-700';
        const status = fv < minVal     ? '⛔ Нарушение норматива'
                  : fv < redLine       ? '🔴 Красная зона'
                  : fv < yellowLine    ? '🟡 Жёлтая зона'
                  : '✅ В норме';
        const bufFc = minVal > 0 ? ((fv / minVal - 1) * 100).toFixed(1) : '—';
        const formula = `${fmtN(lastL)} + ${h}×${lastS >= 0?'':' ('}${fmtN(lastS)}${lastS<0?')':''} = ${fmtN(fv)}`;

        return `<div class="rounded-xl border-2 ${cls} p-5">
            <div class="flex justify-between items-start mb-3">
                <div>
                    <p class="text-xs font-semibold uppercase tracking-wide opacity-60">Период +${h}</p>
                    <p class="text-sm font-bold opacity-70">${forecastDates[i]}</p>
                </div>
                <span class="text-xs font-bold px-2 py-1 rounded-full bg-white bg-opacity-60 ${textCls}">${status}</span>
            </div>
            <p class="text-3xl font-bold ${textCls} mb-2">${fmt(fv)}</p>
            <p class="text-xs opacity-60 font-mono mb-3">F(${h}) = ${formula}</p>
            <div class="text-xs space-y-1 opacity-70">
                <div class="flex justify-between"><span>Минимум:</span><span class="font-semibold">${fmt(minVal)}</span></div>
                <div class="flex justify-between"><span>Буфер прогноза:</span><span class="font-semibold">${bufFc}%</span></div>
                <div class="flex justify-between"><span>σ отклонение:</span><span class="font-semibold">±${fmtN(sigma)}${suffix}</span></div>
            </div>
        </div>`;
    }).join('');

    // ── ИНТЕРПРЕТАЦИЯ ────────────────────────────────────────────────────
    const stepsToBreak = calcStepsToBreak(levels, slopes, minVal, forecastVals);
    const trendDesc = lastS > 0
        ? `Тренд восходящий: показатель растёт в среднем на <b>${fmtN(Math.abs(lastS))}${suffix}</b> за период. Это позитивный сигнал.`
        : lastS < 0
            ? `Тренд нисходящий: показатель снижается в среднем на <b>${fmtN(Math.abs(lastS))}${suffix}</b> за период. Требует мониторинга.`
            : `Тренд стабильный — существенного направленного движения не наблюдается.`;

    const breakDesc = stepsToBreak !== null
        ? `<div class="p-3 rounded-lg bg-red-50 border border-red-200">
               <p class="font-semibold text-red-700">🚨 При сохранении текущего тренда норматив будет пробит через ~<b>${stepsToBreak}</b> период(а).</p>
               <p class="text-red-600 text-xs mt-1">Рекомендуется принять меры до наступления следующего расчётного периода.</p>
           </div>`
        : `<div class="p-3 rounded-lg bg-green-50 border border-green-200">
               <p class="text-green-700">✅ При сохранении текущего тренда пробой минимального норматива в горизонте 10 периодов не ожидается.</p>
           </div>`;

    const outlierNote = outliersN > 0
        ? `<div class="p-3 rounded-lg bg-yellow-50 border border-yellow-200">
               <p class="font-semibold text-yellow-700">⚠️ ${outliersN} точка(и) исключена как выброс</p>
               <p class="text-yellow-600 text-xs mt-1">Аномально высокие значения в начале ряда (>10× медианы) искажают тренд и исключаются из расчёта. Если эти значения корректны, рассмотрите возможность разбить историю на два периода.</p>
           </div>` : '';

    document.getElementById('fcd-interpretation').innerHTML = `
        <div class="p-3 rounded-lg bg-[#F5F0EB] border border-[#E0D9D4]">
            <p class="font-semibold mb-1">Направление тренда</p>
            <p class="text-[#7D7471]">${trendDesc}</p>
        </div>
        ${breakDesc}
        <div class="p-3 rounded-lg bg-[#F5F0EB] border border-[#E0D9D4]">
            <p class="font-semibold mb-1">Точность модели</p>
            <p class="text-[#7D7471]">Стандартное отклонение остатков σ = <b>${fmtN(sigma)}${suffix}</b>.
            ${sigma / Math.abs(lastL || 1) > 0.3
                ? ' Высокая волатильность — прогноз менее надёжен, используйте как ориентир.'
                : ' Умеренная волатильность — прогноз достаточно надёжен.'}</p>
        </div>
        ${outlierNote}
        <div class="p-3 rounded-lg bg-blue-50 border border-blue-200">
            <p class="font-semibold text-blue-700 mb-1">Ограничения модели</p>
            <p class="text-blue-600 text-xs leading-relaxed">Метод Холта предполагает сохранение текущего тренда. Он не учитывает сезонность, регуляторные изменения или разовые операции. Прогноз следует рассматривать как ранний сигнал, а не как точное предсказание.</p>
        </div>`;
}
