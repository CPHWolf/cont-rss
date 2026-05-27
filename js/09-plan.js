// ============================================================
// МОДУЛЬ 09: ПЛАН МЕРОПРИЯТИЙ (Годовой план проверок)
// ============================================================
// savePlanItem()       — добавить мероприятие
// deletePlanItem(id)   — удалить
// markPlanItemDone(id) — отметить как выполненное
// renderPlanCalendar() — отрисовать сетку по месяцам
// ============================================================

function initPlanYear() {
    const sel = document.getElementById('plan-year-select');
    if (!sel) return;
    const cur = new Date().getFullYear();
    sel.innerHTML = '';
    for (let y = cur - 1; y <= cur + 2; y++) {
        const opt = document.createElement('option');
        opt.value = y;
        opt.textContent = y + ' год';
        if (y === cur) opt.selected = true;
        sel.appendChild(opt);
    }
}

function savePlanItem() {
    const type = document.getElementById('plan-type').value;
    const date = document.getElementById('plan-date').value;
    const responsible = document.getElementById('plan-responsible').value;
    const note = document.getElementById('plan-note').value;
    if (!date) { alert('Укажите плановую дату!'); return; }

    if (!db.planItems) db.planItems = [];
    db.planItems.push({ id: Date.now(), type, date, responsible, note, status: 'Запланировано' });
    localStorage.setItem('controllerDataV3', JSON.stringify(db));

    document.getElementById('plan-date').value = '';
    document.getElementById('plan-note').value = '';
    document.getElementById('plan-responsible').value = '';
    renderPlanCalendar();
}

function deletePlanItem(id) {
    db.planItems = (db.planItems || []).filter(p => p.id !== id);
    localStorage.setItem('controllerDataV3', JSON.stringify(db));
    renderPlanCalendar();
}

function markPlanItemDone(id) {
    const item = (db.planItems || []).find(p => p.id === id);
    if (item) {
        item.status = item.status === 'Проведено' ? 'Запланировано' : 'Проведено';
        localStorage.setItem('controllerDataV3', JSON.stringify(db));
        renderPlanCalendar();
    }
}

function renderPlanCalendar() {
    if (!db.planItems) db.planItems = [];
    const yearSel = document.getElementById('plan-year-select');
    const year = yearSel ? parseInt(yearSel.value) : new Date().getFullYear();
    const today = new Date().toISOString().split('T')[0];

    const items = db.planItems.filter(p => p.date.startsWith(year));

    // Статистика
    const total = items.length;
    const done = items.filter(p => p.status === 'Проведено').length;
    const overdue = items.filter(p => p.status !== 'Проведено' && p.date < today).length;
    document.getElementById('plan-stat-total').textContent = total;
    document.getElementById('plan-stat-done').textContent = done;
    document.getElementById('plan-stat-overdue').textContent = overdue;
    document.getElementById('plan-stat-pct').textContent = total > 0 ? Math.round(done / total * 100) + '%' : '0%';

    const grid = document.getElementById('plan-calendar-grid');
    const ruMonths = ['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь'];
    grid.innerHTML = '';

    ruMonths.forEach((month, mIdx) => {
        const mStr = String(mIdx + 1).padStart(2, '0');
        const monthItems = items.filter(p => p.date.startsWith(`${year}-${mStr}`));

        const cell = document.createElement('div');
        cell.className = 'bg-gray-50 rounded-xl p-3 border border-[#E0E0E0] min-h-[100px]';

        const hasOverdue = monthItems.some(p => p.status !== 'Проведено' && p.date < today);
        if (hasOverdue) cell.classList.add('border-red-300', 'bg-red-50');

        cell.innerHTML = `<div class="font-bold text-sm text-[#4B4240] mb-2 flex justify-between items-center">
            <span>${month}</span>
            <span class="text-xs font-normal text-[#A69C97]">${monthItems.length} / ${monthItems.filter(p=>p.status==='Проведено').length} ✓</span>
        </div>`;

        if (monthItems.length === 0) {
            cell.innerHTML += '<p class="text-xs text-[#A69C97] italic">Нет мероприятий</p>';
        } else {
            monthItems.forEach(p => {
                const isOverdue = p.status !== 'Проведено' && p.date < today;
                const bgClass = p.status === 'Проведено' ? 'bg-green-100 text-green-800' : isOverdue ? 'bg-red-100 text-red-800' : 'bg-blue-100 text-blue-800';
                const dayStr = p.date.split('-')[2];
                cell.innerHTML += `
                <div class="flex items-start gap-1 mb-1 group">
                    <span class="text-xs ${bgClass} rounded px-1 py-0.5 shrink-0 font-semibold">${dayStr}</span>
                    <span class="text-xs leading-tight flex-1 truncate" title="${p.type} — ${p.note || ''}">${p.type.split('(')[0].trim()}</span>
                    <div class="hidden group-hover:flex gap-1 shrink-0">
                        <button onclick="markPlanItemDone(${p.id})" title="${p.status === 'Проведено' ? 'Отменить' : 'Провести'}" class="text-green-600 hover:text-green-800 text-xs">✓</button>
                        <button onclick="deletePlanItem(${p.id})" class="text-red-400 hover:text-red-600 text-xs">✕</button>
                    </div>
                </div>`;
            });
        }
        grid.appendChild(cell);
    });
}

// =============================================
// ШАБЛОН ПИСЬМА В ЦБ (п. 2.1.12)
// =============================================
