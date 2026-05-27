// ============================================================
// МОДУЛЬ 11: КОНФЛИКТЫ ИНТЕРЕСОВ
// ============================================================
// resetConflictForm()    — очистить форму
// editConflict(id)       — заполнить форму
// saveConflict()         — добавить / сохранить
// deleteConflict(id)     — удалить
// clearConflictFilters() — сбросить фильтры
// renderConflicts()      — отрисовать таблицу
// ============================================================

function resetConflictForm() {
    ['coi-date','coi-parties','coi-responsible','coi-resolved-date','coi-result'].forEach(id => {
        const el = document.getElementById(id); if (el) el.value = '';
    });
    const d = document.getElementById('coi-description'); if (d) d.value = '';
    const t = document.getElementById('coi-type'); if (t) t.value = 'Брокер vs Дилер';
    const r = document.getElementById('coi-risk'); if (r) r.value = 'Низкий';
    const s = document.getElementById('coi-status'); if (s) s.value = 'Выявлен';
    const rt = document.getElementById('coi-resolution-type'); if (rt) rt.value = '';
    const ei = document.getElementById('coi-editing-id'); if (ei) ei.value = '';
    const ft = document.getElementById('coi-form-title'); if (ft) ft.textContent = 'Зарегистрировать конфликт';
    const cb = document.getElementById('coi-cancel-btn'); if (cb) cb.classList.add('hidden');
}

function editConflict(id) {
    const c = (db.conflicts||[]).find(x => x.id === id);
    if (!c) return;
    const set = (eid, val) => { const el = document.getElementById(eid); if (el) el.value = val || ''; };
    set('coi-date',             c.date);
    set('coi-type',             c.type);
    set('coi-risk',             c.risk || 'Низкий');
    set('coi-description',      c.description);
    set('coi-parties',          c.parties);
    set('coi-responsible',      c.responsible);
    set('coi-status',           c.status || 'Выявлен');
    set('coi-resolution-type',  c.resolutionType);
    set('coi-resolved-date',    c.resolvedDate);
    set('coi-result',           c.result);
    set('coi-editing-id',       id);
    const ft = document.getElementById('coi-form-title'); if (ft) ft.textContent = '✏️ Редактирование записи';
    const cb = document.getElementById('coi-cancel-btn'); if (cb) cb.classList.remove('hidden');
    document.getElementById('section-conflicts')?.scrollIntoView({ behavior:'smooth', block:'start' });
}

function saveConflict() {
    const date        = document.getElementById('coi-date').value;
    const description = document.getElementById('coi-description').value;
    if (!date || !description) { alert('Укажите дату выявления и описание конфликта!'); return; }
    const editingId = document.getElementById('coi-editing-id').value;
    const record = {
        date,
        type:           document.getElementById('coi-type').value,
        risk:           document.getElementById('coi-risk').value,
        description,
        parties:        document.getElementById('coi-parties').value,
        responsible:    document.getElementById('coi-responsible').value,
        status:         document.getElementById('coi-status').value,
        resolutionType: document.getElementById('coi-resolution-type').value,
        resolvedDate:   document.getElementById('coi-resolved-date').value,
        result:         document.getElementById('coi-result').value,
    };
    let auditBefore = '', auditAfter = '', auditAction;
    if (editingId) {
        const idx = (db.conflicts||[]).findIndex(x => x.id === parseInt(editingId));
        if (idx !== -1) {
            auditBefore = `Статус: ${db.conflicts[idx].status} | Риск: ${db.conflicts[idx].risk}`;
            db.conflicts[idx] = { ...db.conflicts[idx], ...record };
            auditAfter  = `Статус: ${record.status} | Риск: ${record.risk}`;
        }
        auditAction = 'Изменено';
    } else {
        record.id = Date.now();
        if (!db.conflicts) db.conflicts = [];
        db.conflicts.push(record);
        auditAction = 'Создано';
        auditAfter  = `Вид: ${record.type} | Риск: ${record.risk} | Статус: ${record.status}`;
    }
    writeAudit({
        section: 'Конфликт интересов', action: auditAction,
        objectId: editingId || record.id,
        objectDesc: description.slice(0,100),
        details: `Вид: ${record.type} | Риск: ${record.risk} | Статус: ${record.status}`,
        before: auditBefore,
        after:  auditAfter,
    });
    saveDb();
    resetConflictForm();
    renderConflicts();
}

function deleteConflict(id) {
    if (!confirm('Удалить запись о конфликте интересов?')) return;
    const c = (db.conflicts||[]).find(x => x.id === id);
    if (c) {
        writeAudit({
            section: 'Конфликт интересов', action: 'Удалено',
            objectId: id,
            objectDesc: (c.description||'').slice(0,100),
            details: `Вид: ${c.type} | Риск: ${c.risk} | Статус: ${c.status}`,
            before: `Статус: ${c.status} | Риск: ${c.risk} | Стороны: ${c.parties||'—'}`,
            after: '— УДАЛЕНО —',
        });
    }
    db.conflicts = (db.conflicts||[]).filter(x => x.id !== id);
    saveDb();
    renderConflicts();
}

function clearConflictFilters() {
    ['coi-filter-type','coi-filter-status','coi-filter-risk','coi-filter-from','coi-filter-to'].forEach(id => {
        const el = document.getElementById(id); if (el) el.value = '';
    });
    renderConflicts();
}

function renderConflicts() {
    const tbody = document.getElementById('conflicts-table-body');
    if (!tbody) return;
    if (!db.conflicts) db.conflicts = [];

    const fType   = document.getElementById('coi-filter-type')?.value   || '';
    const fStatus = document.getElementById('coi-filter-status')?.value || '';
    const fRisk   = document.getElementById('coi-filter-risk')?.value   || '';
    const fFrom   = document.getElementById('coi-filter-from')?.value   || '';
    const fTo     = document.getElementById('coi-filter-to')?.value     || '';

    let list = [...db.conflicts].sort((a, b) => new Date(b.date) - new Date(a.date));
    if (fType)   list = list.filter(c => c.type === fType);
    if (fStatus) list = list.filter(c => c.status === fStatus);
    if (fRisk)   list = list.filter(c => c.risk === fRisk);
    if (fFrom)   list = list.filter(c => c.date >= fFrom);
    if (fTo)     list = list.filter(c => c.date <= fTo);

    const all = db.conflicts;
    const setStat = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
    setStat('coi-stat-total',    all.length);
    setStat('coi-stat-open',     all.filter(c => c.status === 'Выявлен' || c.status === 'В урегулировании').length);
    setStat('coi-stat-resolved', all.filter(c => c.status === 'Урегулирован' || c.status === 'Раскрыт клиенту').length);
    setStat('coi-stat-high',     all.filter(c => c.risk === 'Высокий').length);

    const cl = document.getElementById('coi-count-label');
    if (cl) cl.textContent = `Показано: ${list.length} из ${all.length}`;

    if (list.length === 0) {
        tbody.innerHTML = '<tr><td colspan="10" class="p-8 text-center text-[#A69C97] italic">Конфликтов не зафиксировано</td></tr>';
        return;
    }
    const riskBadge   = { 'Высокий':'bg-red-100 text-red-700', 'Средний':'bg-yellow-100 text-yellow-700', 'Низкий':'bg-green-100 text-green-700' };
    const statusBadge = { 'Выявлен':'bg-red-100 text-red-700', 'В урегулировании':'bg-yellow-100 text-yellow-700', 'Урегулирован':'bg-green-100 text-green-700', 'Раскрыт клиенту':'bg-blue-100 text-blue-700' };
    tbody.innerHTML = '';
    list.forEach(c => {
        const isOpen = c.status === 'Выявлен' || c.status === 'В урегулировании';
        const row = document.createElement('tr');
        row.className = `border-b ${c.risk==='Высокий'&&isOpen?'bg-red-50':'hover:bg-gray-50'} transition`;
        row.setAttribute('data-row-id', c.id);
        row.innerHTML = `
            <td class="p-3 text-sm whitespace-nowrap">${c.date}</td>
            <td class="p-3 text-sm font-semibold">${c.type}</td>
            <td class="p-3 text-sm text-gray-700 max-w-[180px]" title="${c.description||''}">${(c.description||'').slice(0,60)}${(c.description||'').length>60?'…':''}</td>
            <td class="p-3 text-sm text-gray-500">${c.parties||'—'}</td>
            <td class="p-3"><span class="px-2 py-1 rounded text-xs font-bold ${riskBadge[c.risk]||'bg-gray-100 text-gray-600'}">${c.risk}</span></td>
            <td class="p-3"><span class="px-2 py-1 rounded text-xs font-bold ${statusBadge[c.status]||'bg-gray-100 text-gray-600'}">${c.status}</span></td>
            <td class="p-3 text-xs text-gray-600">${c.resolutionType||'—'}</td>
            <td class="p-3 text-sm">${c.responsible||'—'}</td>
            <td class="p-3 text-sm whitespace-nowrap">${c.resolvedDate||'—'}</td>
            <td class="p-3 whitespace-nowrap">
                <button onclick="editConflict(${c.id})" class="text-blue-400 hover:text-blue-600 text-sm mr-1">✏️</button>
                <button onclick="deleteConflict(${c.id})" class="text-red-400 hover:text-red-600 text-sm">🗑️</button>
            </td>`;
        tbody.appendChild(row);
    });
}

// ---- Обновлённый аудит-перехват для проверок (edit + create) ----
