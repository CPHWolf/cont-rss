// ============================================================
// МОДУЛЬ 03: ГРАФИКИ (Chart.js)
// ============================================================
// updateReportCharts() — обновить пончик/бар на Сводке
// updateGanttChart()   — перерисовать диаграмму Ганта
// createCharts()       — инициализация всех графиков
// ============================================================

        function updateReportCharts() {
            const statusCounts = { 'Выявлено': 0, 'В работе': 0, 'Устранено': 0 };
            const taxonomyCounts = {};
            
            db.events.forEach(event => {
                statusCounts[event.status] = (statusCounts[event.status] || 0) + 1;
                
                const fullLabel = event.classification;
                taxonomyCounts[fullLabel] = (taxonomyCounts[fullLabel] || 0) + 1;
            });

            if (riskStatusChart) {
                riskStatusChart.data.labels = Object.keys(statusCounts);
                riskStatusChart.data.datasets[0].data = Object.values(statusCounts);
                riskStatusChart.update();
            }

            if (riskTaxonomyChart) {
                riskTaxonomyChart.data.labels = Object.keys(taxonomyCounts);
                riskTaxonomyChart.data.datasets[0].data = Object.values(taxonomyCounts);
                riskTaxonomyChart.update();
            }
        }

  function updateGanttChart(periodCode) {
    if (!ganttChart) return;
    
    if (!periodCode) {
        const sel = document.getElementById('gantt-quarter-select');
        if (sel) periodCode = sel.value;
    }
    if (!periodCode) return;

    const parts = periodCode.split('-');
    if (parts.length < 2) return; 

    const year = parseInt(parts[0]);
    const type = parts[1];
    
    let minDate, maxDate;
    let targetMonthIndices = [];

    if (type.startsWith('Q')) {
        const qNum = parseInt(type.replace('Q', ''));
        const startMonthIndex = (qNum - 1) * 3;
        targetMonthIndices = [startMonthIndex, startMonthIndex + 1, startMonthIndex + 2];
        minDate = `${year}-${String(startMonthIndex + 1).padStart(2, '0')}-01`;
        const lastDayDate = new Date(year, startMonthIndex + 3, 0); 
        maxDate = lastDayDate.toISOString().split('T')[0];
    } else {
        const mIndex = parseInt(type);
        targetMonthIndices = [mIndex];
        minDate = `${year}-${String(mIndex + 1).padStart(2, '0')}-01`;
        const lastDayDate = new Date(year, mIndex + 1, 0);
        maxDate = lastDayDate.toISOString().split('T')[0];
    }

    const periodMs = new Date(maxDate).getTime() - new Date(minDate).getTime();
    const minBarMs = periodMs * 0.015; // 1.5% от периода — минимальная ширина полоски

    // Фильтры
    const taxonomyFilter = document.getElementById('gantt-taxonomy-filter')?.value || '';
    const statusFilter = document.getElementById('gantt-status-filter')?.value || '';

    let quarterEvents = db.events.filter(e => {
        const d = new Date(e.date);
        if (!(d.getFullYear() === year && targetMonthIndices.includes(d.getMonth()))) return false;
        if (taxonomyFilter && !e.classification.startsWith(taxonomyFilter)) return false;
        if (statusFilter && e.status !== statusFilter) return false;
        return true;
    });

    quarterEvents.sort((a, b) => new Date(a.date) - new Date(b.date));

    // Пустое состояние
    const emptyEl = document.getElementById('gantt-empty');
    const canvasEl = document.getElementById('ganttChart');
    if (quarterEvents.length === 0) {
        if (emptyEl) emptyEl.classList.remove('hidden');
        if (canvasEl) canvasEl.style.display = 'none';
        return;
    }
    if (emptyEl) emptyEl.classList.add('hidden');
    if (canvasEl) canvasEl.style.display = '';

    // Цвета по статусу с интенсивностью по рейтингу
    function getBarColor(event) {
        const rating = parseInt(event.riskRating || 1); // 1..5
        const alpha = 0.35 + (rating - 1) * 0.16; // 0.35 (рейтинг 1) → 0.99 (рейтинг 5)
        const baseColors = {
            'Выявлено':  `rgba(231, 76, 60,  ${alpha})`,
            'В работе':  `rgba(243,156, 18,  ${alpha})`,
            'Устранено': `rgba(46, 204, 113, ${alpha})`
        };
        return baseColors[event.status] || `rgba(166,156,151,${alpha})`;
    }

    const labels = [];
    const data = [];
    const backgroundColors = [];
    const borderColors = [];
    const borderWidths = [];

    quarterEvents.forEach(event => {
        // Метка по оси Y: ID + ⚠ если существенное
        const prefix = event.isSubstantial ? '⚠ ' : '';
        labels.push(`${prefix}#${event.id}`);

        const startDate = new Date(event.date);
        let endDate;
        if (event.status === 'Устранено' && event.remedyDate && event.remedyDate !== '-') {
            endDate = new Date(event.remedyDate);
        } else {
            endDate = new Date();
        }
        if (endDate <= startDate) {
            endDate = new Date(startDate.getTime() + minBarMs);
        }
        // Tooltip-first: если длительность < minBarMs, растягиваем визуально, но тултип покажет правду
        const visualEnd = (endDate.getTime() - startDate.getTime()) < minBarMs
            ? new Date(startDate.getTime() + minBarMs)
            : endDate;

        data.push([startDate.getTime(), visualEnd.getTime()]);
        backgroundColors.push(getBarColor(event));
        // Существенные — выделяем жирной рамкой
        borderColors.push(event.isSubstantial ? '#C0392B' : 'transparent');
        borderWidths.push(event.isSubstantial ? 2 : 0);
    });

    ganttChart.data.labels = labels;
    ganttChart.data.datasets[0].data = data;
    ganttChart.data.datasets[0].backgroundColor = backgroundColors;
    ganttChart.data.datasets[0].borderColor = borderColors;
    ganttChart.data.datasets[0].borderWidth = borderWidths;
    ganttChart.data.datasets[0].rawEvents = quarterEvents;
    ganttChart.options.scales.x.min = minDate;
    ganttChart.options.scales.x.max = maxDate;

    // Динамическая высота холста
    const rowHeight = 36;
    const canvasHeight = Math.max(200, quarterEvents.length * rowHeight + 60);
    if (canvasEl) canvasEl.parentElement.style.height = canvasHeight + 'px';

    ganttChart.update();
}

        function createCharts() {
            const kpiCtx = document.getElementById('kpiComparisonChart')?.getContext('2d');
            if (kpiCtx) {
                kpiComparisonChart = new Chart(kpiCtx, {
                    type: 'line',
                    data: {
                        labels: ['Период 1', 'Период 2'],
                        datasets: [
                            { label: 'Всего Выявлено', data: [], borderColor: '#4B4240', tension: 0.1, fill: false },
                            { label: 'Существенных', data: [], borderColor: '#D9A86E', tension: 0.1, fill: false },
                            { label: 'В Работе', data: [], borderColor: '#F39C12', tension: 0.1, fill: false },
                            { label: 'Устранено', data: [], borderColor: '#2ECC71', tension: 0.1, fill: false }
                        ]
                    },
                    options: {
                        maintainAspectRatio: false, responsive: true, ...mandatoryTooltipConfig
                    }
                });
            }

            const ganttCtx = document.getElementById('ganttChart')?.getContext('2d');
            if (ganttCtx) {
                ganttChart = new Chart(ganttCtx, {
                    type: 'bar',
                    data: {
                        labels: [],
                        datasets: [{
                            label: 'Событие Риска',
                            data: [],
                            backgroundColor: [],
                            borderColor: [],
                            borderWidth: [],
                            borderSkipped: false,
                            borderRadius: 3,
                            barPercentage: 0.6
                        }]
                    },
                    options: {
                        maintainAspectRatio: false,
                        responsive: true,
                        indexAxis: 'y',
                        onClick: function(evt, elements) {
                            if (!elements || elements.length === 0) return;
                            const idx = elements[0].index;
                            const events = this.data.datasets[0].rawEvents;
                            if (!events || !events[idx]) return;
                            const eventId = events[idx].id;
                            // Переходим к реестру и скроллим к событию
                            document.querySelector('.nav-link[data-target="section-register"]').click();
                            setTimeout(() => {
                                // Сбрасываем фильтры чтобы событие точно было видно
                                const searchEl = document.getElementById('filter-search');
                                if (searchEl) { searchEl.value = ''; }
                                filterAndRenderRegister();
                                // Ищем строку с нужным ID и подсвечиваем
                                const rows = document.querySelectorAll('#risk-register-table tr');
                                rows.forEach(row => {
                                    const editBtn = row.querySelector('button[onclick*="editEvent"]');
                                    if (editBtn && editBtn.getAttribute('onclick').includes(`(${eventId})`)) {
                                        row.style.transition = 'background 0.3s';
                                        row.style.background = '#FFF9C4';
                                        row.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                        setTimeout(() => row.style.background = '', 2500);
                                    }
                                });
                            }, 300);
                        },
                        scales: {
                            x: {
                                type: 'time',
                                time: { unit: 'day', displayFormats: { day: 'dd MMM' } },
                                min: '2025-07-01',
                                max: '2025-09-30',
                                ticks: { color: '#7D7471', maxTicksLimit: 10 },
                                grid: { color: '#E0E0E0' }
                            },
                            y: {
                                ticks: { 
                                    color: '#7D7471', 
                                    font: { size: 11, weight: 'bold' },
                                    // Показываем только ID, полный текст — в тултипе
                                    callback: function(value, index) {
                                        return this.getLabelForValue(value);
                                    }
                                },
                                grid: { display: false }
                            }
                        },
                        plugins: {
                            legend: { display: false },
                            tooltip: {
                                callbacks: {
                                    title: function(tooltipItems) {
                                        const item = tooltipItems[0];
                                        const events = item.chart.data.datasets[0].rawEvents;
                                        if (!events || !events[item.dataIndex]) return '';
                                        const ev = events[item.dataIndex];
                                        return `#${ev.id}${ev.isSubstantial ? ' ⚠ СУЩЕСТВЕННОЕ' : ''}: ${ev.description}`;
                                    },
                                    label: function(context) {
                                        const events = context.chart.data.datasets[0].rawEvents;
                                        if (!events || !events[context.dataIndex]) return '';
                                        const ev = events[context.dataIndex];
                                        const startStr = new Date(ev.date).toLocaleDateString('ru-RU');
                                        const lines = [
                                            `Статус: ${ev.status}`,
                                            `Рейтинг риска: ${ev.riskRating || 1}/5`,
                                            `Таксономия: ${ev.classification}`,
                                            `Выявлено: ${startStr}`,
                                        ];
                                        if (ev.status === 'Устранено' && ev.remedyDate && ev.remedyDate !== '-') {
                                            const sameDay = ev.remedyDate === ev.date;
                                            lines.push(`Устранено: ${new Date(ev.remedyDate).toLocaleDateString('ru-RU')}`);
                                        } else {
                                            const deadline = ev.deadline ? `Дедлайн: ${ev.deadline}` : 'Дедлайн: не задан';
                                            lines.push(deadline);
                                        }
                                        if (ev.responsible) lines.push(`Ответственный: ${ev.responsible}`);
                                        return lines;
                                    }
                                },
                                backgroundColor: 'rgba(75,66,64,0.95)',
                                titleFont: { size: 12, weight: 'bold' },
                                bodyFont: { size: 11 },
                                padding: 12,
                                displayColors: false
                            }
                        },
                        cursor: 'pointer'
                    }
                });
            }

            const controlCtx = document.getElementById('controlTrendChart')?.getContext('2d');
            if (controlCtx) {
                controlTrendChart = new Chart(controlCtx, {
                    type: 'line',
                    data: {
                        labels: MONTHS.map(m => MONTH_NAMES[m]),
                        datasets: [
                            {
                                label: 'Проверки Прав Клиентов (шт.)',
                                data: MONTHS.map(m => db.checks[m]?.clients || 0),
                                borderColor: '#D9A86E',
                                tension: 0.3,
                                fill: false
                            },
                            {
                                label: 'Проверки Рекламы (шт.)',
                                data: MONTHS.map(m => db.checks[m]?.ads || 0),
                                borderColor: '#8C7D6F',
                                tension: 0.3,
                                fill: false
                            }
                        ]
                    },
                    options: {
                        maintainAspectRatio: false, responsive: true,
                        scales: {
                            y: { beginAtZero: true, ticks: { color: '#7D7471', stepSize: 1 }, grid: { color: '#E0E0E0' } },
                            x: { ticks: { color: '#7D7471' }, grid: { display: false } }
                        },
                        ...mandatoryTooltipConfig
                    }
                });
            }

            const statusCtx = document.getElementById('riskStatusChart')?.getContext('2d');
            if (statusCtx) {
                riskStatusChart = new Chart(statusCtx, {
                    type: 'doughnut',
                    data: {
                        labels: ['Выявлено', 'В работе', 'Устранено'],
                        datasets: [{
                            data: [0, 0, 0],
                            backgroundColor: ['#D9A86E', '#F39C12', '#2ECC71'] 
                        }]
                    },
                    options: { maintainAspectRatio: false, responsive: true, ...mandatoryTooltipConfig }
                });
            }

            const taxonomyCtx = document.getElementById('riskTaxonomyChart')?.getContext('2d');
            if (taxonomyCtx) {
                riskTaxonomyChart = new Chart(taxonomyCtx, {
                    type: 'bar',
                    data: {
                        labels: [],
                        datasets: [{
                            label: 'Кол-во событий по Таксономии',
                            data: [],
                            backgroundColor: '#4B4240'
                        }]
                    },
                    options: { 
                        maintainAspectRatio: false, responsive: true,
                        indexAxis: 'y',
                        scales: {
                            y: { 
                                beginAtZero: true, 
                                ticks: { 
                                    color: '#7D7471', 
                                    stepSize: 1, 
                                    autoSkip: false, 
                                    font: { size: 10 },
                                    align: 'start',
                                    callback: function(value, index, values) {
                                        let label = this.getLabelForValue(value);
                                        if (label.length > 35) {
                                            return label.substring(0, 35) + '...';
                                        }
                                        return label;
                                    }
                                }, 
                                grid: { color: '#E0E0E0' } 
                            },
                            x: { ticks: { color: '#7D7471', stepSize: 1 }, grid: { display: false } }
                        },
                        plugins: {
                            tooltip: {
                                callbacks: {
                                    title: function(tooltipItems) {
                                        const item = tooltipItems[0];
                                        return item.chart.data.labels[item.dataIndex];
                                    }
                                }
                            }
                        }
                    }
                });
            }
        }
        

