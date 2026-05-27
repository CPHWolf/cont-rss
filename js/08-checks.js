// ============================================================
// МОДУЛЬ 08: ПРОВЕРКИ (Журнал проверок)
// ============================================================
// resetCheckForm()      — очистить форму
// editCheckRecord(id)   — заполнить форму
// clearCheckFilters()   — сбросить фильтры
// renderCheckRecords()  — отрисовать журнал
// saveCheckRecord()     — добавить / редактировать
// deleteCheckRecord()   — удалить
// switchChecksTab()     — переключить план / журнал
// ============================================================

function resetCheckForm() {
    ['chk-date','chk-object','chk-link','chk-findings','chk-measures','chk-inspector'].forEach(id => {
        const el = document.getElementById(id); if (el) el.value = '';
    });
    const fs = document.getElementById('chk-fix-status'); if (fs) fs.value = 'Не применимо';
    const ei = document.getElementById('chk-editing-id'); if (ei) ei.value = '';
    const ft = document.getElementById('chk-form-title'); if (ft) ft.textContent = 'Регистрация проверки';
    const cb = document.getElementById('chk-cancel-btn'); if (cb) cb.classList.add('hidden');
}

function editCheckRecord(id) {
    const r = (db.checkRecords || []).find(x => x.id === id);
    if (!r) return;
    const set = (eid, val) => { const el = document.getElementById(eid); if (el) el.value = val || ''; };
    set('chk-type',       r.type);
    set('chk-date',       r.date);
    set('chk-object',     r.object);
    set('chk-inspector',  r.inspector);
    set('chk-result',     r.result || 'Нарушений не выявлено');
    set('chk-findings',   r.findings);
    set('chk-measures',   r.measures);
    set('chk-fix-status', r.fixStatus || 'Не применимо');
    set('chk-link',       r.link);
    set('chk-editing-id', id);
    const ft = document.getElementById('chk-form-title'); if (ft) ft.textContent = '✏️ Редактирование проверки';
    const cb = document.getElementById('chk-cancel-btn'); if (cb) cb.classList.remove('hidden');
    document.getElementById('checks-log-panel')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function clearCheckFilters() {
    ['chk-filter-type','chk-filter-result','chk-filter-from','chk-filter-to'].forEach(id => {
        const el = document.getElementById(id); if (el) el.value = '';
    });
    renderCheckRecords();
}

function renderCheckRecords() {
    const tbody = document.getElementById('checks-table-body');
    if (!tbody) return;
    if (!db.checkRecords) db.checkRecords = [];

    const fType   = document.getElementById('chk-filter-type')?.value   || '';
    const fResult = document.getElementById('chk-filter-result')?.value || '';
    const fFrom   = document.getElementById('chk-filter-from')?.value   || '';
    const fTo     = document.getElementById('chk-filter-to')?.value     || '';

    let list = [...db.checkRecords].sort((a, b) => new Date(b.date) - new Date(a.date));
    if (fType)   list = list.filter(r => r.type === fType);
    if (fResult) list = list.filter(r => r.result === fResult);
    if (fFrom)   list = list.filter(r => r.date >= fFrom);
    if (fTo)     list = list.filter(r => r.date <= fTo);

    const all = db.checkRecords;
    const setStat = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
    setStat('chk-stat-total',      all.length);
    setStat('chk-stat-ok',         all.filter(r => r.result === 'Нарушений не выявлено').length);
    setStat('chk-stat-violations', all.filter(r => r.result === 'Выявлены нарушения').length);
    setStat('chk-stat-open',       all.filter(r => r.result === 'Выявлены нарушения' && r.fixStatus !== 'Устранено').length);

    const cl = document.getElementById('chk-count-label');
    if (cl) cl.textContent = `Показано: ${list.length} из ${all.length}`;

    if (list.length === 0) {
        tbody.innerHTML = '<tr><td colspan="9" class="p-8 text-center text-[#A69C97] italic">Проверок не найдено</td></tr>';
        return;
    }
    tbody.innerHTML = '';
    list.forEach(rec => {
        const row = document.createElement('tr');
        row.setAttribute('data-row-id', rec.id);
        let resCls = 'bg-green-100 text-green-700';
        if (rec.result === 'Выявлены нарушения') resCls = 'bg-red-100 text-red-700';
        else if (rec.result === 'Требует доработки') resCls = 'bg-yellow-100 text-yellow-700';
        let fixCls = 'text-gray-400';
        if (rec.fixStatus === 'Устранено') fixCls = 'text-green-600 font-semibold';
        if (rec.fixStatus === 'В работе')  fixCls = 'text-orange-500';
        const highlight = rec.result === 'Выявлены нарушения' && rec.fixStatus !== 'Устранено';
        row.className = `border-b ${highlight ? 'bg-red-50' : 'hover:bg-gray-50'} transition`;
        const linkHtml = rec.link ? `<a href="${rec.link}" target="_blank" class="text-blue-500 hover:text-blue-700">📄 Акт</a>` : '—';
        const findHtml = rec.findings ? `<div class="text-red-600 text-xs">${rec.findings.slice(0,60)}${rec.findings.length>60?'…':''}</div>` : '';
        const measHtml = rec.measures  ? `<div class="text-gray-500 text-xs mt-1">→ ${rec.measures.slice(0,60)}${rec.measures.length>60?'…':''}</div>` : '';
        row.innerHTML = `
            <td class="p-3 text-sm whitespace-nowrap">${rec.date}</td>
            <td class="p-3 text-sm font-semibold">${rec.type}</td>
            <td class="p-3 text-sm text-gray-600" title="${rec.object||''}">${(rec.object||'').slice(0,40)}${(rec.object||'').length>40?'…':''}</td>
            <td class="p-3 text-sm">${rec.inspector||'—'}</td>
            <td class="p-3"><span class="px-2 py-1 rounded text-xs font-bold ${resCls}">${rec.result}</span></td>
            <td class="p-3 text-xs max-w-[200px]">${findHtml}${measHtml}</td>
            <td class="p-3 text-sm ${fixCls}">${rec.fixStatus||'—'}</td>
            <td class="p-3">${linkHtml}</td>
            <td class="p-3 whitespace-nowrap">
                <button onclick="editCheckRecord(${rec.id})" class="text-blue-400 hover:text-blue-600 text-sm mr-1">✏️</button>
                <button onclick="deleteCheckRecord(${rec.id})" class="text-red-400 hover:text-red-600 text-sm">🗑️</button>
            </td>`;
        tbody.appendChild(row);
    });
}

function saveCheckRecord() {
    const date   = document.getElementById('chk-date').value;
    const object = document.getElementById('chk-object').value;
    if (!date || !object) { alert('Укажите дату и объект проверки!'); return; }
    const editingId = document.getElementById('chk-editing-id')?.value;
    const record = {
        type:      document.getElementById('chk-type').value,
        date, object,
        inspector: document.getElementById('chk-inspector')?.value || '',
        result:    document.getElementById('chk-result').value,
        findings:  document.getElementById('chk-findings')?.value || '',
        measures:  document.getElementById('chk-measures')?.value || '',
        fixStatus: document.getElementById('chk-fix-status')?.value || 'Не применимо',
        link:      document.getElementById('chk-link').value,
    };
    if (editingId) {
        const idx = (db.checkRecords||[]).findIndex(x => x.id === parseInt(editingId));
        if (idx !== -1) db.checkRecords[idx] = { ...db.checkRecords[idx], ...record };
    } else {
        record.id = Date.now();
        if (!db.checkRecords) db.checkRecords = [];
        db.checkRecords.push(record);
    }
    saveDb();
    resetCheckForm();
    renderCheckRecords();
}

function deleteCheckRecord(id) {
    if(confirm('Удалить запись о проверке?')) {
        db.checkRecords = (db.checkRecords||[]).filter(r => r.id !== id);
        saveDb();
        renderCheckRecords();
    }
}
function switchChecksTab(tab) {
    // Годовой план удалён. Всегда показываем журнал.
    const logPanel = document.getElementById('checks-log-panel');
    const tabLog = document.getElementById('tab-log');
    if (logPanel) logPanel.classList.remove('hidden');
    if (tabLog) {
        tabLog.classList.add('border-[#D9A86E]', 'text-[#D9A86E]');
        tabLog.classList.remove('border-transparent', 'text-[#7D7471]');
    }
    renderCheckRecords();
}

