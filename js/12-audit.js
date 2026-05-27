// ============================================================
// МОДУЛЬ 12: ЛОГ АУДИТА
// ============================================================
// initAuditLog()         — инициализация структуры в db
// writeAudit({...})      — записать действие в лог
//   Обязательные поля: section, action, objectId, objectDesc
//   Опциональные: details, before, after, beforeObj, afterObj
// renderAuditLog()       — отрисовать таблицу лога
// clearAuditFilters()    — сбросить фильтры
// exportAuditToExcel()   — XLSX выгрузка
// ============================================================

let auditPage = 0;
const AUDIT_PAGE_SIZE = 50;

function initAuditLog() {
    if (!db.auditLog) db.auditLog = [];
}

// Вспомогательная функция сохранения БД

// Центральная функция записи события аудита
function writeAudit({ section, action, objectId, objectDesc, details, before, after, beforeObj, afterObj }) {
    initAuditLog();
    const now = new Date();
    const entry = {
        id: now.getTime(),
        ts: now.toISOString(),
        tsDisplay: now.toLocaleString('ru-RU'),
        section,
        action,
        objectId: objectId ?? '',
        objectDesc: (objectDesc || '').slice(0, 120),
        details: details || '',
        // Поддержка структурированного before/after (объект с полями) для точной подсветки
        before: beforeObj ? JSON.stringify(beforeObj) : (before !== undefined ? String(before).slice(0, 400) : ''),
        after:  afterObj  ? JSON.stringify(afterObj)  : (after  !== undefined ? String(after).slice(0, 400) : ''),
        structured: !!(beforeObj || afterObj), // флаг: перед сравнением разбирать как JSON
    };
    db.auditLog.unshift(entry);
    if (db.auditLog.length > 2000) db.auditLog = db.auditLog.slice(0, 2000);
}

// ---- РЕНДЕР ТАБЛИЦЫ АУДИТ-ЛОГА ----
function renderAuditLog() {
    initAuditLog();
    const sectionF = document.getElementById('audit-filter-section')?.value || '';
    const actionF  = document.getElementById('audit-filter-action')?.value || '';
    const fromF    = document.getElementById('audit-filter-from')?.value || '';
    const toF      = document.getElementById('audit-filter-to')?.value || '';
    const searchF  = (document.getElementById('audit-filter-search')?.value || '').toLowerCase();

    const today = new Date().toISOString().split('T')[0];

    let filtered = db.auditLog.filter(e => {
        if (sectionF && e.section !== sectionF) return false;
        if (actionF  && e.action  !== actionF)  return false;
        const eDate = e.ts.split('T')[0];
        if (fromF && eDate < fromF) return false;
        if (toF   && eDate > toF)   return false;
        if (searchF && !(
            e.objectDesc.toLowerCase().includes(searchF) ||
            e.details.toLowerCase().includes(searchF) ||
            String(e.objectId).includes(searchF)
        )) return false;
        return true;
    });

    // Статистика
    const allLog = db.auditLog;
    document.getElementById('audit-stat-total').textContent   = allLog.length;
    document.getElementById('audit-stat-today').textContent   = allLog.filter(e => e.ts.startsWith(today)).length;
    document.getElementById('audit-stat-creates').textContent = allLog.filter(e => e.action === 'Создано').length;
    document.getElementById('audit-stat-edits').textContent   = allLog.filter(e => e.action !== 'Создано').length;

    const total = filtered.length;
    const totalPages = Math.max(1, Math.ceil(total / AUDIT_PAGE_SIZE));
    if (auditPage >= totalPages) auditPage = totalPages - 1;
    if (auditPage < 0) auditPage = 0;

    document.getElementById('audit-shown-count').textContent = Math.min(AUDIT_PAGE_SIZE, total - auditPage * AUDIT_PAGE_SIZE);
    document.getElementById('audit-total-count').textContent = total;
    document.getElementById('audit-page-info').textContent = `стр. ${auditPage + 1} из ${totalPages}`;

    const prevBtn = document.getElementById('audit-prev-btn');
    const nextBtn = document.getElementById('audit-next-btn');
    if (prevBtn) prevBtn.disabled = auditPage === 0;
    if (nextBtn) nextBtn.disabled = auditPage >= totalPages - 1;

    const page = filtered.slice(auditPage * AUDIT_PAGE_SIZE, (auditPage + 1) * AUDIT_PAGE_SIZE);
    const tbody = document.getElementById('audit-table-body');
    if (!tbody) return;

    if (page.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="p-8 text-center text-[#A69C97] italic">Нет записей по выбранным фильтрам</td></tr>';
        return;
    }

    const actionColors = {
        'Создано':         'bg-green-100 text-green-700',
        'Изменено':        'bg-blue-100 text-blue-700',
        'Удалено':         'bg-red-100 text-red-700',
        'Статус изменён':  'bg-yellow-100 text-yellow-700',
    };
    const sectionIcons = {
        'Реестр событий':  '📋',
        'Предписания':     '📄',
        'Проверки':        '🔍',
        'Жалобы':          '📩',
        'Фин. показатели': '📊',
        'План проверок':   '📅',
        'База знаний':     '📚',
        'Система':         '⚙️',
    };

    tbody.innerHTML = page.map(e => {
        const aColor = actionColors[e.action] || 'bg-gray-100 text-gray-600';
        const icon = sectionIcons[e.section] || '📁';
        // Рендер "Было → Стало" с точечной подсветкой только изменившихся полей
        let beforeAfter;
        if (!e.before && !e.after) {
            beforeAfter = '<span class="text-gray-300">—</span>';
        } else if (e.structured) {
            // Структурированный объект — сравниваем попарно
            let bObj = {}, aObj = {};
            try { bObj = JSON.parse(e.before || '{}'); } catch(ex) {}
            try { aObj = JSON.parse(e.after  || '{}'); } catch(ex) {}
            const allKeys = [...new Set([...Object.keys(bObj), ...Object.keys(aObj)])];
            // Читаемые метки
            const LABELS = {
                description:'Описание', eventDate:'Дата события', date:'Дата обнаружения',
                source:'Источник', riskRating:'Рейтинг', classification:'Таксономия',
                isSubstantial:'Существенное', responsible:'Ответственный', deadline:'Дедлайн',
                status:'Статус', measures:'Мероприятия', measuresDone:'Реализация',
                remedyMark:'Устранение', remedyDate:'Дата устранения',
                preventionMark:'Меры повт.', preventionDate:'Дата мер',
                orderMark:'Исп.предписаний', orderDate:'Дата исп.',
                hasOrder:'Наличие предписания', recurrence:'Вер.повторения',
            };
            const beforeParts = [], afterParts = [];
            for (const key of allKeys) {
                const bVal = String(bObj[key] ?? '');
                const aVal = String(aObj[key] ?? '');
                const label = LABELS[key] || key;
                const changed = bVal !== aVal;
                if (changed) {
                    if (bVal) beforeParts.push(
                        `<span class="text-red-500 line-through font-semibold">${label}: ${bVal}</span>`
                    );
                    if (aVal) afterParts.push(
                        `<span class="text-green-600 font-semibold">${label}: ${aVal}</span>`
                    );
                } else {
                    // Не изменилось — показываем без подсветки
                    if (bVal) beforeParts.push(
                        `<span class="text-gray-400">${label}: ${bVal}</span>`
                    );
                }
            }
            const bHtml = beforeParts.length ? beforeParts.join(' <span class="text-gray-300">|</span> ') : '';
            const aHtml = afterParts.length  ? afterParts.join(' <span class="text-gray-300">|</span> ')  : '';
            beforeAfter = [
                bHtml ? `<div class="mb-1">${bHtml}</div>` : '',
                bHtml && aHtml ? '<div class="text-gray-400 text-xs mb-1">↓</div>' : '',
                aHtml ? `<div>${aHtml}</div>` : '',
            ].filter(Boolean).join('');
        } else {
            // Плоская строка — старый формат, целиком зачёркиваем
            beforeAfter =
                `<span class="text-red-500 line-through">${e.before || ''}</span>` +
                (e.before && e.after ? ' → ' : '') +
                `<span class="text-green-600 font-semibold">${e.after || ''}</span>`;
        }
        return `<tr class="border-b border-gray-50 hover:bg-gray-50 transition">
            <td class="p-3 text-xs text-[#7D7471] whitespace-nowrap font-mono">${e.tsDisplay}</td>
            <td class="p-3 text-sm">${icon} ${e.section}</td>
            <td class="p-3"><span class="text-xs font-bold px-2 py-1 rounded-full ${aColor}">${e.action}</span></td>
            <td class="p-3 text-xs text-[#4B4240]">${e.objectId ? `<span class="font-mono text-[#A69C97]">#${e.objectId}</span> ` : ''}${e.objectDesc}</td>
            <td class="p-3 text-xs text-[#7D7471] max-w-[240px]">${e.details || '—'}</td>
            <td class="p-3 text-xs">${beforeAfter}</td>
        </tr>`;
    }).join('');
}

function clearAuditFilters() {
    ['audit-filter-section','audit-filter-action','audit-filter-from','audit-filter-to','audit-filter-search']
        .forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
    auditPage = 0;
    renderAuditLog();
}

async function exportAuditToExcel() {
    initAuditLog();
    if (!db.auditLog.length) { alert('Журнал пуст'); return; }
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Аудит-лог');
    sheet.columns = [
        { header: 'Дата и время', key: 'tsDisplay', width: 22 },
        { header: 'Раздел',       key: 'section',   width: 20 },
        { header: 'Действие',     key: 'action',    width: 18 },
        { header: 'ID объекта',   key: 'objectId',  width: 12 },
        { header: 'Объект',       key: 'objectDesc',width: 40 },
        { header: 'Детали',       key: 'details',   width: 40 },
        { header: 'Было',         key: 'before',    width: 25 },
        { header: 'Стало',        key: 'after',     width: 25 },
    ];
    const hRow = sheet.getRow(1);
    hRow.eachCell(cell => {
        cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4B4240' } };
        cell.alignment = { vertical: 'middle' };
    });
    const actionFill = {
        'Создано':        'FFD1FAE5',
        'Изменено':       'FFDBEAFE',
        'Удалено':        'FFFEE2E2',
        'Статус изменён': 'FFFEF9C3',
    };
    db.auditLog.forEach(e => {
        const row = sheet.addRow(e);
        const fill = actionFill[e.action];
        if (fill) {
            row.eachCell({ includeEmpty: true }, cell => {
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: fill } };
            });
        }
        row.eachCell({ includeEmpty: true }, cell => {
            cell.border = { top:{style:'thin'}, left:{style:'thin'}, bottom:{style:'thin'}, right:{style:'thin'} };
        });
    });
    const buf = await workbook.xlsx.writeBuffer();
    saveAs(new Blob([buf]), `AuditLog_${new Date().toISOString().split('T')[0]}.xlsx`);
}
