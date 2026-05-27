// ============================================================
// МОДУЛЬ 13: ОТЧЁТЫ И ЭКСПОРТ
// ============================================================
// generateReport()        — квартальный отчёт (Приложение 7)
// printReport()           — печать отчёта
// exportDashboardPDF()    — PDF для руководства
// populateCBEventSelect() — список событий для письма в ЦБ
// fillCBLetter()          — шаблон письма в ЦБ
// copyCBLetter()          — копировать в буфер
// printCBLetter()         — печать письма
// downloadBackup()        — бэкап базы в JSON
// restoreBackup()         — восстановить из JSON
// ============================================================

        function generateReport() {
            const quarter = document.getElementById('report-quarter').value;
            const probability = document.getElementById('report-probability').value;
            const rating = document.getElementById('report-rating').value;
            
            if (!rating) {
                alert('Пожалуйста, укажите Рейтинг Последствий (1-5) для отчета.');
                return;
            }

            // Определяем диапазон дат квартала
            const parts = quarter.split('-');
            const year = parseInt(parts[0]);
            const qType = parts[1];
            let startMonth, endMonth;
            if (qType === 'Q1') { startMonth = 0; endMonth = 2; }
            else if (qType === 'Q2') { startMonth = 3; endMonth = 5; }
            else if (qType === 'Q3') { startMonth = 6; endMonth = 8; }
            else { startMonth = 9; endMonth = 11; }

            const periodEvents = db.events.filter(e => {
                const d = new Date(e.date);
                return d.getFullYear() === year && d.getMonth() >= startMonth && d.getMonth() <= endMonth;
            });

            const today = new Date().toISOString().split('T')[0];
            const totalEvents = periodEvents.length;
            const substantialEvents = periodEvents.filter(e => e.isSubstantial).length;
            const inProgressEvents = periodEvents.filter(e => e.status === 'В работе' || e.status === 'Выявлено').length;
            const resolvedEvents = periodEvents.filter(e => e.status === 'Устранено').length;
            const overdueEvents = periodEvents.filter(e => e.deadline && e.deadline < today && e.status !== 'Устранено').length;

            // Обращения за период
            const periodComplaints = (db.complaints || []).filter(c => {
                const d = new Date(c.date);
                return d.getFullYear() === year && d.getMonth() >= startMonth && d.getMonth() <= endMonth;
            });
            const complaintsTotal = periodComplaints.length;
            const complaintsDone = periodComplaints.filter(c => c.status === 'Рассмотрено').length;
            const complaintsActive = periodComplaints.filter(c => c.status !== 'Рассмотрено').length;
            const complaintsRisk = periodComplaints.filter(c => c.riskDetected === 'Да').length;

            // Проверки за период  
            const periodChecks = (db.checkRecords || []).filter(c => {
                const d = new Date(c.date);
                return d.getFullYear() === year && d.getMonth() >= startMonth && d.getMonth() <= endMonth;
            });
            let checksHtml = '';
            if (periodChecks.length === 0) {
                checksHtml = '<p>Проверок за период не зафиксировано.</p>';
            } else {
                const violations = periodChecks.filter(c => c.result === 'Выявлены нарушения').length;
                checksHtml = `<p>Проведено проверок: <b>${periodChecks.length}</b>. Из них выявлены нарушения: <b class="text-red-600">${violations}</b>. Нарушений не выявлено: <b class="text-green-600">${periodChecks.length - violations}</b>.</p>`;
                checksHtml += '<ul class="mt-2 ml-4 list-disc space-y-1">';
                periodChecks.forEach(c => {
                    const cls = c.result === 'Выявлены нарушения' ? 'text-red-600' : 'text-green-700';
                    checksHtml += `<li><span class="${cls}">${c.result}</span> — ${c.type} (${c.date}): ${c.object}</li>`;
                });
                checksHtml += '</ul>';
            }

            // Рекомендации — генерируем динамически на основе данных
            const recommendations = [];
            if (substantialEvents > 0) recommendations.push(`⚠ Выявлено <b>${substantialEvents}</b> существенных событий — требуется уведомление ЦБ РФ в течение 2 рабочих дней (п. 2.1.12 Указания).`);
            if (overdueEvents > 0) recommendations.push(`⏰ <b>${overdueEvents}</b> событий с истёкшим дедлайном устранения — обеспечить срочное закрытие и анализ причин просрочки.`);
            if (complaintsRisk > 0) recommendations.push(`📋 По <b>${complaintsRisk}</b> обращениям выявлены события регуляторного риска — проверить полноту внесения в реестр.`);
            
            // Топ таксономии
            const taxCount = {};
            periodEvents.forEach(e => { taxCount[e.classification.split('.')[0]] = (taxCount[e.classification.split('.')[0]] || 0) + 1; });
            const topTax = Object.entries(taxCount).sort((a,b)=>b[1]-a[1]).slice(0,2);
            if (topTax.length > 0) recommendations.push(`📊 Наиболее частые группы рисков за период: ${topTax.map(t=>`<b>${t[0]}</b> (${t[1]} сл.)`).join(', ')} — усилить превентивный контроль.`);
            
            if (recommendations.length === 0) recommendations.push('✅ Существенных нарушений не выявлено. Рекомендуется поддержание текущего уровня контроля.');

            // Предписания за период
            const periodOrders = (db.orders || []).filter(o => {
                const d = new Date(o.dateIn);
                return d.getFullYear() === year && d.getMonth() >= startMonth && d.getMonth() <= endMonth;
            });
            let ordersHtml = '';
            if (periodOrders.length === 0) {
                ordersHtml = '<p>Предписаний/запросов за период не поступало.</p>';
            } else {
                ordersHtml = `<p>Получено предписаний/запросов: <b>${periodOrders.length}</b>.</p><ul class="mt-2 ml-4 list-disc space-y-1">`;
                periodOrders.forEach(o => {
                    const cls = o.status === 'Исполнено' ? 'text-green-700' : 'text-orange-600';
                    ordersHtml += `<li>Вх. № ${o.number} от ${o.dateIn} — <span class="${cls}">${o.status}</span>. Дедлайн: ${o.deadline}.</li>`;
                });
                ordersHtml += '</ul>';
            }

            db.quarterlyReport[quarter] = { probability, rating: parseInt(rating) };
            localStorage.setItem('controllerDataV3', JSON.stringify(db));

            document.getElementById('report-q-title').textContent = quarter;
            document.getElementById('report-events-total').textContent = totalEvents;
            document.getElementById('report-events-substantial').textContent = substantialEvents;
            document.getElementById('report-events-resolved').textContent = resolvedEvents;
            document.getElementById('report-events-inprogress').textContent = inProgressEvents;
            document.getElementById('report-events-overdue').textContent = overdueEvents;
            document.getElementById('report-complaints').textContent = complaintsTotal;
            document.getElementById('report-complaints-done').textContent = complaintsDone;
            document.getElementById('report-complaints-active').textContent = complaintsActive;
            document.getElementById('report-complaints-risk').textContent = complaintsRisk;
            document.getElementById('report-checks-summary').innerHTML = checksHtml;
            document.getElementById('report-recommendations').innerHTML = recommendations.map(r => `<p>• ${r}</p>`).join('');
            document.getElementById('report-orders-summary').innerHTML = ordersHtml;
            document.getElementById('report-prob-final').textContent = probability;
            document.getElementById('report-rating-final').textContent = rating;
            
            document.getElementById('report-output').classList.remove('hidden');
            document.getElementById('report-output').scrollIntoView({ behavior: 'smooth' });
        }
        // --- ФУНКЦИОНАЛ УПРАВЛЕНИЯ ССЫЛКАМИ ---

function downloadBackup() {
    // 1. Подготовка данных
    const dataStr = JSON.stringify(db, null, 4); 
    const blob = new Blob([dataStr], {type: "application/json"});
    
    // 2. Формирование имени файла с датой и временем
    const now = new Date();
    
    // Получаем YYYY-MM-DD
    const date = now.toISOString().split('T')[0]; 
    
    // Получаем HH-MM (часы и минуты), заменяем двоеточие на тире
    const time = now.toTimeString().split(' ')[0].slice(0, 5).replace(':', '-');
    
    // Итоговое имя: Controller_Full_Backup_2025-11-18_14-30.json
    const fileName = `Controller_Full_Backup_${date}_${time}.json`;
    
    // 3. Скачивание
    saveAs(blob, fileName); 
}

function restoreBackup(inputElement) {
    const file = inputElement.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const importedData = JSON.parse(e.target.result);
            
            // Проверка структуры: есть ли массив событий и объект проверок
            if (importedData.events && Array.isArray(importedData.events) && importedData.checks) {
                if(confirm(`Внимание! Загрузка Backup заменит ВСЕ текущие данные.\nНайдено событий в файле: ${importedData.events.length}.\nПродолжить?`)) {
                    
                    db = importedData;
                    localStorage.setItem('controllerDataV3', JSON.stringify(db));
                    
                    alert('Данные успешно восстановлены. Страница перезагружается.');
                    location.reload(); 
                }
            } else {
                alert('Ошибка: Выбранный файл не является корректным бэкапом этой системы.');
            }
        } catch (err) {
            console.error(err);
            alert('Ошибка чтения JSON файла.');
        }
    };
    
    inputElement.value = ''; // Сброс, чтобы можно было выбрать тот же файл снова
    reader.readAsText(file);
}
// --- ЛОГИКА ПРЕДПИСАНИЙ ---
function printReport() {
    const reportContent = document.getElementById('report-output').innerHTML;
    const w = window.open('', '_blank');
    w.document.write(`
        <html><head><title>Отчёт Контролера</title>
        <style>body{font-family:Arial,sans-serif;padding:20px;font-size:13px;}h2{color:#4B4240;}h3{color:#7D7471;}p{margin:4px 0;}ul{margin-left:20px;}</style>
        </head><body>${reportContent}<br><p style="color:gray;font-size:11px;">Сформировано: ${new Date().toLocaleString('ru-RU')}</p></body></html>
    `);
    w.document.close();
    w.print();
}
function populateCBEventSelect() {
    const sel = document.getElementById('cb-event-select');
    if (!sel) return;
    const substantials = (db.events || []).filter(e => e.isSubstantial);
    sel.innerHTML = '<option value="">— Выберите существенное событие —</option>';
    substantials.forEach(e => {
        const opt = document.createElement('option');
        opt.value = e.id;
        opt.textContent = `#${e.id} | ${e.date} | ${e.description.substring(0, 50)}${e.description.length > 50 ? '…' : ''}`;
        sel.appendChild(opt);
    });
}

function fillCBLetter() {
    const sel = document.getElementById('cb-event-select');
    const id = parseInt(sel.value);
    if (!id) { alert('Выберите событие из списка'); return; }
    const ev = (db.events || []).find(e => e.id === id);
    if (!ev) return;

    const today = new Date().toLocaleDateString('ru-RU');
    const eventDate = ev.eventDate && ev.eventDate !== '-' ? ev.eventDate : ev.date;
    const measures = ev.measures && ev.measures !== '-' ? ev.measures : 'меры по устранению определяются';

    const text = `УВЕДОМЛЕНИЕ О НАСТУПЛЕНИИ СУЩЕСТВЕННОГО СОБЫТИЯ РЕГУЛЯТОРНОГО РИСКА
(п. 2.1.12 Указания Банка России от 28.12.2020 № 5683-У)

Дата составления: ${today}

В Банк России (в соответствии с порядком взаимодействия, определённым ст. 76.9 Федерального закона от 10.07.2002 № 86-ФЗ)

Настоящим уведомляем о наступлении существенного события регуляторного риска:

1. ДАТА ВЫЯВЛЕНИЯ СОБЫТИЯ: ${ev.date}
2. ДАТА ВОЗНИКНОВЕНИЯ СОБЫТИЯ: ${eventDate}
3. ОПИСАНИЕ СОБЫТИЯ: ${ev.description}
4. КЛАССИФИКАЦИЯ (ТАКСОНОМИЯ): ${ev.classification}
5. РЕЙТИНГ РИСКА: ${ev.riskRating || '—'} из 5
6. ИСТОЧНИК ВЫЯВЛЕНИЯ: ${ev.source || '—'}
7. НАЛИЧИЕ ПРЕДПИСАНИЯ ЦБ/СРО: ${ev.hasOrder || 'Нет'}

ПРИНЯТЫЕ МЕРЫ В СВЯЗИ С НАСТУПЛЕНИЕМ СОБЫТИЯ:
${measures}

ОТВЕТСТВЕННЫЙ ЗА УСТРАНЕНИЕ: ${ev.responsible || 'определяется'}
СРОК УСТРАНЕНИЯ: ${ev.deadline || 'определяется'}

С уважением,
Контролер / Руководитель службы внутреннего контроля
_____________________________
(подпись, дата)`;

    document.getElementById('cb-letter-text').textContent = text;
    document.getElementById('cb-letter-output').classList.remove('hidden');
}

function copyCBLetter() {
    const text = document.getElementById('cb-letter-text').textContent;
    navigator.clipboard.writeText(text).then(() => alert('Текст скопирован в буфер обмена'));
}

function printCBLetter() {
    const text = document.getElementById('cb-letter-text').textContent;
    const w = window.open('', '_blank');
    w.document.write(`<html><head><title>Уведомление в ЦБ</title>
    <style>body{font-family:Arial,sans-serif;padding:40px;font-size:13px;line-height:1.6;}pre{white-space:pre-wrap;}</style>
    </head><body><pre>${text}</pre></body></html>`);
    w.document.close(); w.print();
}

// =============================================
// ЭКСПОРТ ДАШБОРДА В PDF ДЛЯ РУКОВОДСТВА
// =============================================
function exportDashboardPDF() {
    const today = new Date().toLocaleDateString('ru-RU');
    const qSel = document.getElementById('pdf-quarter-select');
    const qCode = qSel ? qSel.value : '';
    let periodLabel = 'За всё время';

    // Универсальный фильтр по периоду — принимает любую дату строкой YYYY-MM-DD
    function inPeriod(dateStr) {
        if (!qCode) return true;
        if (!dateStr) return false;
        const parts = qCode.split('-');
        const year = parseInt(parts[0]);
        const q = parseInt(parts[1].replace('Q',''));
        const d = new Date(dateStr);
        return d.getFullYear() === year && Math.floor(d.getMonth() / 3) + 1 === q;
    }

    if (qCode) {
        const parts = qCode.split('-');
        const qNum = parts[1].replace('Q','');
        const qNames = {'1':'1','2':'2','3':'3','4':'4'};
        periodLabel = `${parts[0]} — ${qNames[qNum]||qNum} квартал`;
    }

    // ---- События реестра за период ----
    const allEvents = db.events || [];
    const events = allEvents.filter(e => inPeriod(e.date));
    const overdueEvents = events.filter(e => e.deadline && e.deadline < new Date().toISOString().split('T')[0] && e.status !== 'Устранено');
    const substantial = events.filter(e => e.isSubstantial);
    const inProgress = events.filter(e => e.status === 'В работе');
    const resolved = events.filter(e => e.status === 'Устранено');

    // ---- Предписания за период (по дате получения) ----
    const allOrders = db.orders || [];
    const orders = allOrders.filter(o => inPeriod(o.dateIn));
    const overdueOrders = allOrders.filter(o => o.deadline && o.deadline < new Date().toISOString().split('T')[0] && o.status !== 'Исполнено');

    // ---- Жалобы за период ----
    const allComplaints = db.complaints || [];
    const complaints = allComplaints.filter(c => inPeriod(c.date));

    // ---- Проверки за период ----
    const allChecks = db.checkRecords || [];
    const checks = allChecks.filter(c => inPeriod(c.date));

    // ---- Фин. показатели: последнее значение за период (или вообще последнее если период не задан) ----
    const allFinRecords = db.financials?.records || [];
    const mins = db.financials?.mins || {};
    const getLatestFin = (type) => {
        const recs = allFinRecords
            .filter(r => r.type === type && inPeriod(r.date))
            .sort((a,b) => new Date(b.date) - new Date(a.date));
        // Если в периоде нет — берём вообще последнее
        if (!recs.length && !qCode) {
            return allFinRecords.filter(r => r.type === type).sort((a,b) => new Date(b.date) - new Date(a.date))[0] || null;
        }
        return recs[0] || null;
    };
    const nkd = getLatestFin('nkd');
    const nkl = getLatestFin('nkl');
    const eq  = getLatestFin('equity');

    // ---- Хелперы ----
    const finRow = (label, rec, minVal, unit) => rec
        ? `<tr><td>${label}</td><td><b>${rec.value.toLocaleString('ru-RU')}${unit}</b></td>
           <td>${minVal.toLocaleString('ru-RU')}${unit}</td>
           <td style="color:${rec.value < minVal ? 'red' : rec.value < minVal*1.1 ? 'orange' : 'green'};font-weight:bold">
           ${rec.value < minVal ? '⛔ Нарушение' : rec.value < minVal*1.1 ? '⚠ На грани' : '✅ Норма'}
           </td><td style="color:#888;font-size:10px">${rec.date}</td></tr>`
        : `<tr><td>${label}</td><td colspan="4" style="color:gray;font-style:italic">Нет данных за период</td></tr>`;

    const noData = (section) =>
        `<p style="color:gray;font-style:italic;margin:4px 0">Нет записей за выбранный период${section ? ' (' + section + ')' : ''}</p>`;

    const w = window.open('', '_blank');
    w.document.write(`<!DOCTYPE html><html lang="ru"><head>
    <meta charset="UTF-8"><title>Отчёт контролера — ${periodLabel}</title>
    <style>
        body { font-family: Arial, sans-serif; font-size: 12px; color: #222; padding: 30px; max-width: 960px; margin: 0 auto; }
        h1 { font-size: 18px; color: #4B4240; border-bottom: 3px solid #D9A86E; padding-bottom: 8px; margin-bottom: 4px; }
        .period-badge { display:inline-block; background:#D9A86E; color:white; font-size:11px; font-weight:bold; padding:2px 10px; border-radius:20px; margin-bottom:16px; }
        h2 { font-size: 13px; color: #4B4240; margin-top: 22px; margin-bottom: 6px; border-left: 4px solid #D9A86E; padding-left: 8px; background:#fdf9f5; padding-top:4px; padding-bottom:4px; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 12px; font-size: 11px; }
        th { background: #4B4240; color: white; padding: 5px 7px; text-align: left; font-size:10px; }
        td { padding: 4px 7px; border-bottom: 1px solid #eee; vertical-align:top; }
        tr:nth-child(even) { background: #fafafa; }
        .kpi-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 18px; }
        .kpi { background: #f9f7f4; border: 1px solid #e0d9d3; border-radius: 8px; padding: 10px; text-align: center; }
        .kpi .val { font-size: 26px; font-weight: bold; color: #4B4240; }
        .kpi .lbl { font-size: 9px; color: #7D7471; text-transform: uppercase; margin-top: 3px; }
        .alert-red { background: #fee2e2; border: 1px solid #fca5a5; border-radius: 6px; padding: 7px 12px; margin-bottom: 8px; color: #b91c1c; font-weight: bold; font-size: 11px; }
        .stat-row { display:flex; gap:20px; margin-bottom:10px; font-size:11px; }
        .stat-item { background:#f5f5f5; border-radius:6px; padding:4px 12px; }
        .footer { margin-top: 36px; font-size: 10px; color: #aaa; border-top: 1px solid #eee; padding-top: 12px; }
        @media print { body { padding: 10px; } button { display:none; } }
    </style></head><body>
    <h1>📋 Сводный отчёт</h1>
    <div class="period-badge">📅 Период: ${periodLabel}</div>
    <p style="color:#7D7471;font-size:11px;margin-top:4px;">Сформирован: ${today} </p>

    ${overdueEvents.length > 0 ? `<div class="alert-red">⛔ ВНИМАНИЕ: ${overdueEvents.length} событий просрочено без устранения!</div>` : ''}

    <h2>1. Ключевые показатели за период</h2>
    <div class="kpi-grid">
        <div class="kpi"><div class="val">${events.length}</div><div class="lbl">Выявлено событий</div></div>
        <div class="kpi"><div class="val" style="color:#C0392B">${substantial.length}</div><div class="lbl">Существенных</div></div>
        <div class="kpi"><div class="val" style="color:orange">${inProgress.length}</div><div class="lbl">В работе</div></div>
        <div class="kpi"><div class="val" style="color:green">${resolved.length}</div><div class="lbl">Устранено</div></div>
    </div>

    <h2>2. Финансовые показатели (актуальное за период)</h2>
    <table><thead><tr><th>Показатель</th><th>Факт</th><th>Минимум</th><th>Статус</th><th>Дата</th></tr></thead><tbody>
        ${finRow('НДК', nkd, mins.nkd ?? 100, '%')}
        ${finRow('НКЛ', nkl, mins.nkl ?? 100, '%')}
        ${finRow('Собственные средства', eq, mins.equity ?? 3000, '')}
    </tbody></table>

    <h2>3. Все события реестра за период (${events.length})</h2>
    ${events.length > 0
        ? `<table><thead><tr><th>#</th><th>Дата события</th><th>Дата выявления</th><th>Описание</th><th>Таксономия</th><th>Сущ.</th><th>Рейтинг</th><th>Статус</th><th>Ответственный</th><th>Дедлайн</th></tr></thead><tbody>
        ${events.map(e => `<tr ${e.isSubstantial ? 'style="background:#fff5f5"' : ''}>
            <td>${e.id}</td><td>${e.eventDate||'—'}</td><td>${e.date}</td>
            <td>${e.description}</td>
            <td style="font-size:10px">${e.classification}</td>
            <td style="color:${e.isSubstantial?'red':'gray'};font-weight:bold">${e.isSubstantial?'Да':'Нет'}</td>
            <td style="text-align:center">${e.riskRating||'—'}</td>
            <td style="color:${e.status==='Устранено'?'green':e.status==='В работе'?'orange':'red'};font-weight:bold">${e.status}</td>
            <td>${e.responsible||'—'}</td>
            <td style="color:${e.deadline&&e.deadline<new Date().toISOString().split('T')[0]&&e.status!=='Устранено'?'red':'inherit'}">${e.deadline||'—'}</td>
        </tr>`).join('')}
        </tbody></table>`
        : noData('события')}

    <h2>4. Просроченные события (${overdueEvents.length})</h2>
    ${overdueEvents.length > 0
        ? `<table><thead><tr><th>#</th><th>Описание</th><th>Ответственный</th><th>Дедлайн</th><th>Дней просрочки</th></tr></thead><tbody>
        ${overdueEvents.map(e => {
            const days = Math.floor((new Date()-new Date(e.deadline))/(86400000));
            return `<tr style="background:#fee2e2">
                <td>${e.id}</td><td>${e.description}</td><td>${e.responsible||'—'}</td>
                <td style="color:red;font-weight:bold">${e.deadline}</td>
                <td style="color:red;font-weight:bold">+${days} дн.</td>
            </tr>`;
        }).join('')}
        </tbody></table>`
        : '<p style="color:green;font-style:italic">✅ Просроченных событий нет</p>'}

    <h2>5. Предписания ЦБ/СРО за период (${orders.length})</h2>
    ${orders.length > 0
        ? `<table><thead><tr><th>Вх. №</th><th>Дата получения</th><th>Суть</th><th>Дедлайн</th><th>Статус</th></tr></thead><tbody>
        ${orders.map(o => `<tr>
            <td>${o.number}</td><td>${o.dateIn}</td>
            <td>${o.description||'—'}</td>
            <td>${o.deadline}</td>
            <td style="color:${o.status==='Исполнено'?'green':'orange'};font-weight:bold">${o.status}</td>
        </tr>`).join('')}
        </tbody></table>`
        : noData('предписания')}

    <h2>6. Просроченные предписания (${overdueOrders.length})</h2>
    ${overdueOrders.length > 0
        ? `<table><thead><tr><th>#</th><th>Вх. №</th><th>Суть предписания</th><th>Дедлайн</th><th>Дней просрочки</th><th>Статус</th></tr></thead><tbody>
        ${overdueOrders.map((o, i) => {
            const days = Math.floor((new Date() - new Date(o.deadline)) / 86400000);
            return '<tr style="background:#fff3cd">'
                + '<td>' + (i+1) + '</td><td>' + o.number + '</td>'
                + '<td>' + (o.description||'—') + '</td>'
                + '<td style="color:#856404;font-weight:bold">' + o.deadline + '</td>'
                + '<td style="color:#856404;font-weight:bold">+' + days + ' дн.</td>'
                + '<td style="color:orange;font-weight:bold">' + o.status + '</td>'
                + '</tr>';
        }).join('')}
        </tbody></table>`
        : '<p style="color:green;font-style:italic">✅ Просроченных предписаний нет</p>'}

    <h2>7. Обращения (жалобы) за период (${complaints.length})</h2>
    ${complaints.length > 0
        ? `<div class="stat-row">
            <div class="stat-item">Всего: <b>${complaints.length}</b></div>
            <div class="stat-item">Рассмотрено: <b style="color:green">${complaints.filter(c=>c.status==='Рассмотрено').length}</b></div>
            <div class="stat-item">В рассмотрении: <b style="color:orange">${complaints.filter(c=>c.status!=='Рассмотрено').length}</b></div>
            <div class="stat-item">Выявлен риск: <b style="color:red">${complaints.filter(c=>c.riskDetected==='Да').length}</b></div>
          </div>
          <table><thead><tr><th>Дата</th><th>Дедлайн</th><th>Суть</th><th>Канал</th><th>Статус</th><th>Риск</th></tr></thead><tbody>
          ${complaints.map(c => `<tr>
              <td>${c.date}</td><td>${c.deadline||'—'}</td>
              <td>${(c.description||'').slice(0,60)}</td>
              <td>${c.channel||'—'}</td>
              <td>${c.status||'—'}</td>
              <td style="color:${c.riskDetected==='Да'?'red':'gray'}">${c.riskDetected||'—'}</td>
          </tr>`).join('')}
          </tbody></table>`
        : noData('жалобы')}

    <h2>8. Проверки за период (${checks.length})</h2>
    ${checks.length > 0
        ? `<table><thead><tr><th>Дата</th><th>Вид проверки</th><th>Объект</th><th>Результат</th></tr></thead><tbody>
        ${checks.map(c => `<tr>
            <td>${c.date}</td><td>${c.type}</td><td>${c.object||'—'}</td>
            <td style="color:${c.result==='Выявлены нарушения'?'red':'green'}">${c.result}</td>
        </tr>`).join('')}
        </tbody></table>`
        : noData('проверки')}

    <div class="footer">
        Период: ${periodLabel} | Дата формирования: ${today}<br><br>
        <table style="width:100%;margin-top:8px;font-size:11px">
            <tr>
                <td style="width:50%;padding-right:20px">
                    Генеральный директор: _____________________<br>
                    <span style="font-size:9px;color:#aaa">подпись / расшифровка</span>
                </td>
                <td style="width:50%">
                    Контролер: _____________________<br>
                    <span style="font-size:9px;color:#aaa">подпись / расшифровка</span>
                </td>
            </tr>
            <tr style="margin-top:6px">
                <td style="padding-top:6px">Дата: _____________</td>
                <td style="padding-top:6px">Дата: _____________</td>
            </tr>
        </table>
    </div>
    <script>window.print();<\/script>
    </body></html>`);
    w.document.close();
}


// ─── Экспорт графика в PNG ────────────────────────────────────────────────
function exportChartPNG(canvasId, label) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;

    // Создаём новый canvas с белым фоном (иначе PNG прозрачный)
    const exportCanvas = document.createElement('canvas');
    exportCanvas.width  = canvas.width;
    exportCanvas.height = canvas.height;
    const ctx = exportCanvas.getContext('2d');

    // Фон — белый (или тёмный если тёмная тема)
    const isDark = document.documentElement.classList.contains('dark');
    ctx.fillStyle = isDark ? '#2C2826' : '#ffffff';
    ctx.fillRect(0, 0, exportCanvas.width, exportCanvas.height);

    // Рисуем поверх оригинальный canvas
    ctx.drawImage(canvas, 0, 0);

    // Скачиваем
    const date = new Date().toISOString().split('T')[0];
    const a = document.createElement('a');
    a.href = exportCanvas.toDataURL('image/png');
    a.download = `${label}_${date}.png`;
    a.click();
}
