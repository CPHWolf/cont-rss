// ============================================================
// МОДУЛЬ 06: ПРЕДПИСАНИЯ ЦБ / СРО
// ============================================================
// renderOrders()             — отрисовать таблицу
// saveOrder()                — добавить / сохранить
// editOrder(id)              — заполнить форму
// deleteOrder(id)            — удалить
// resetOrderForm()           — очистить форму
// createChildOrder(parentId) — открыть форму дочернего
// exportOrdersToExcel()      — XLSX выгрузка
// ============================================================

let editingOrderId = null;

function renderOrders() {
    const tbody = document.getElementById('orders-table-body');
    if (!tbody) return;
    tbody.innerHTML = '';

    // Сортировка: родительские — "Не исполнено" наверх, затем по дедлайну.
    // Дочернее всегда идёт сразу после своего родителя.
    const parents = (db.orders || []).filter(o => !o.parentId).sort((a, b) => {
        const aNotDone = a.status === 'Не исполнено' ? 0 : 1;
        const bNotDone = b.status === 'Не исполнено' ? 0 : 1;
        if (aNotDone !== bNotDone) return aNotDone - bNotDone;
        return new Date(a.deadline) - new Date(b.deadline);
    });
    const sorted = [];
    parents.forEach(p => {
        sorted.push(p);
        const children = (db.orders || []).filter(o => o.parentId === p.id);
        children.forEach(c => sorted.push(c));
    });

    const today = new Date().toISOString().split('T')[0];
    const finalStatuses = ['Отправлено', 'Исполнено', 'Не исполнено', 'Просрочено'];

    sorted.forEach(ord => {
        const isChild = !!ord.parentId;
        const row = document.createElement('tr');

        // Подсветка строки
        if (isChild) {
            row.className = 'border-b bg-blue-50 hover:bg-blue-100';
        } else {
            row.className = 'border-b hover:bg-gray-50';
        }
        row.setAttribute('data-row-id', ord.id);

        // Статус
        let statusClass = 'bg-gray-100 text-gray-800';
        if (ord.status === 'В работе')         statusClass = 'bg-yellow-50 text-yellow-800';
        if (ord.status === 'На согласовании')  statusClass = 'bg-blue-50 text-blue-800 font-medium';
        if (ord.status === 'Отправлено')       statusClass = 'bg-cyan-100 text-cyan-800 font-bold';
        if (ord.status === 'Исполнено')        statusClass = 'bg-green-100 text-green-800 font-bold';
        if (ord.status === 'Не исполнено')     statusClass = 'bg-red-200 text-red-900 font-bold border border-red-400';
        if (ord.status === 'Просрочено')       statusClass = 'bg-red-100 text-red-800 font-bold';

        let statusDisplay = ord.status;
        const hasChild = (db.orders || []).some(o => o.parentId === ord.id);
        if (!finalStatuses.includes(ord.status) && ord.deadline && ord.deadline < today && !hasChild) {
            statusClass = 'bg-red-200 text-red-900 font-bold border-red-500 border';
            statusDisplay = 'Просрочено!';
        }

        // Номер: у дочернего показываем суффикс (часть после parentNumber)
        let numberDisplay;
        if (isChild) {
            const parent = db.orders.find(o => o.id === ord.parentId);
            const suffix = parent ? ord.number.replace(parent.number, '') : ord.number;
            numberDisplay = `<span class="text-blue-400 font-bold ml-3">⤷</span> <span class="text-blue-300">${suffix}</span>`;
        } else {
            numberDisplay = `<span class="font-bold">${ord.number}</span>`;
        }

        // Иконка ссылки
        const linkIcon = ord.link
            ? `<a href="${ord.link}" target="_blank" class="text-blue-500 mr-1" title="Открыть в облаке">🔗</a>`
            : '';

        // Кнопка "создать дочернее" — только у родительских предписаний
        const childBtn = !isChild
            ? `<button onclick="createChildOrder(${ord.id})" class="text-blue-400 hover:text-blue-700 text-base mr-1" title="Создать дочернее предписание">⤷</button>`
            : '';

        // Тип
        const typeCell = isChild
            ? `<span class="px-2 py-0.5 rounded-full text-xs bg-blue-100 text-blue-700 font-semibold whitespace-nowrap">⤷ Дочернее</span>`
            : `<span class="px-2 py-0.5 rounded-full text-xs bg-gray-100 text-gray-600">Основное</span>`;

        row.innerHTML = `
            <td class="p-3 text-sm">${numberDisplay}</td>
            <td class="p-3 text-sm">${ord.dateIn}</td>
            <td class="p-3 text-sm" title="${ord.description}">${ord.description.substring(0, 30)}...</td>
            <td class="p-3 text-sm font-bold text-red-600">${ord.deadline}</td>
            <td class="p-3 text-center">
                <span class="px-2 py-1 rounded text-xs whitespace-nowrap ${statusClass}">${statusDisplay}</span>
            </td>
            <td class="p-3 text-sm">${ord.dateDone || '-'}</td>
            <td class="p-3 text-center">${typeCell}</td>
            <td class="p-3 text-center whitespace-nowrap">
                ${linkIcon}
                ${childBtn}
                <button onclick="editOrder(${ord.id})" class="text-blue-500 hover:underline mr-1 text-sm">Edit</button>
                <button onclick="deleteOrder(${ord.id})" class="text-red-500 hover:underline text-sm">Del</button>
            </td>
        `;
        tbody.appendChild(row);
    });
}

function saveOrder() {
    const number = document.getElementById('ord-number').value.trim();
    const dateIn = document.getElementById('ord-date-in').value;
    const deadline = document.getElementById('ord-deadline').value;
    const cloudLink = document.getElementById('ord-link').value;
    const parentIdRaw = document.getElementById('ord-parent-id').value;
    const parentId = parentIdRaw ? parseInt(parentIdRaw) : null;
    const nonComplianceReason = document.getElementById('ord-noncompliance-reason').value.trim();

    if (!number || !dateIn) {
        alert('Заполните Номер и Дату получения!');
        return;
    }

    if (!db.orders) db.orders = [];

    // Для дочернего: ord-number содержит ТОЛЬКО суффикс (напр. /2159)
    // Итоговый номер = parentNumber + suffix
    // Для основного: ord-number содержит полный номер
    let finalNumber = number;
    if (parentId) {
        const parentNum = document.getElementById('ord-parent-number-display').value;
        if (parentNum) {
            // Защита от двойного слипания: если номер уже начинается с parentNum — не добавляем
            if (number.startsWith(parentNum)) {
                finalNumber = number; // уже полный — оставляем как есть
            } else {
                finalNumber = parentNum + number;
            }
        }
    }

    const orderData = {
        id: editingOrderId || Date.now(),
        number: finalNumber,
        dateIn: dateIn,
        deadline: deadline,
        description: document.getElementById('ord-description').value,
        source: 'Регулятор',
        responsible: document.getElementById('ord-responsible').value,
        status: document.getElementById('ord-status').value,
        dateDone: document.getElementById('ord-date-done').value,
        link: cloudLink,
        parentId: parentId,
        nonComplianceReason: nonComplianceReason
    };

    if (editingOrderId) {
        const idx = db.orders.findIndex(o => o.id === editingOrderId);
        if (idx > -1) db.orders[idx] = orderData;
    } else {
        db.orders.push(orderData);
    }

    localStorage.setItem('controllerDataV3', JSON.stringify(db));
    renderOrders();
    resetOrderForm();
}

function editOrder(id) {
    const ord = db.orders.find(o => o.id === id);
    if (!ord) return;
    editingOrderId = id;

    const isChild = !!ord.parentId;

    // Показываем/скрываем блок дочернего
    const childBlock = document.getElementById('ord-child-block');
    if (isChild) {
        childBlock.classList.remove('hidden');
        const parent = db.orders.find(o => o.id === ord.parentId);
        document.getElementById('ord-parent-ref').textContent = parent ? `(родитель: ${parent.number})` : '';
        document.getElementById('ord-parent-number-display').value = parent ? parent.number : '';
        document.getElementById('ord-noncompliance-reason').value = ord.nonComplianceReason || '';
        document.getElementById('ord-form-title').textContent = 'Редактирование дочернего предписания';
        const hint3 = document.getElementById('ord-number-hint');
        if (hint3) hint3.classList.remove('hidden');
    } else {
        childBlock.classList.add('hidden');
        document.getElementById('ord-form-title').textContent = 'Редактирование предписания';
    }

    document.getElementById('ord-parent-id').value = ord.parentId || '';
    if (isChild) {
        const parent2 = db.orders.find(o => o.id === ord.parentId);
        const suffix = parent2 ? ord.number.replace(parent2.number, '') : ord.number;
        document.getElementById('ord-number').value = suffix;
    } else {
        document.getElementById('ord-number').value = ord.number;
    }
    document.getElementById('ord-date-in').value = ord.dateIn;
    document.getElementById('ord-description').value = ord.description;
    document.getElementById('ord-deadline').value = ord.deadline;
    document.getElementById('ord-responsible').value = ord.responsible || '';
    document.getElementById('ord-status').value = ord.status;
    document.getElementById('ord-date-done').value = ord.dateDone || '';
    document.getElementById('ord-link').value = ord.link || '';

    document.getElementById('section-orders').scrollIntoView({ behavior: 'smooth' });
}

function createChildOrder(parentId) {
    const parent = db.orders.find(o => o.id === parentId);
    if (!parent) return;

    resetOrderForm();

    // Показываем блок дочернего
    const childBlock = document.getElementById('ord-child-block');
    childBlock.classList.remove('hidden');
    document.getElementById('ord-form-title').textContent = 'Регистрация дочернего предписания';
    document.getElementById('ord-parent-ref').textContent = `(родитель: ${parent.number})`;
    document.getElementById('ord-parent-number-display').value = parent.number;
    document.getElementById('ord-parent-id').value = parentId;
    const hint = document.getElementById('ord-number-hint');
    if (hint) hint.classList.remove('hidden');

    // Наследуем поля из родителя
    document.getElementById('ord-description').value = parent.description;
    document.getElementById('ord-responsible').value = parent.responsible || '';
    document.getElementById('ord-number').value = ''; // вводится только суффикс, напр. /2159
    document.getElementById('ord-status').value = 'В работе';

    document.getElementById('section-orders').scrollIntoView({ behavior: 'smooth' });
}

function deleteOrder(id) {
    // Проверяем есть ли дочерние
    const children = db.orders.filter(o => o.parentId === id);
    if (children.length > 0) {
        if (!confirm(`У этого предписания есть дочерних: ${children.length}. Удалить вместе со всеми дочерними?`)) return;
        db.orders = db.orders.filter(o => o.id !== id && o.parentId !== id);
    } else {
        if (!confirm('Удалить предписание?')) return;
        db.orders = db.orders.filter(o => o.id !== id);
    }
    localStorage.setItem('controllerDataV3', JSON.stringify(db));
    renderOrders();
}

function resetOrderForm() {
    editingOrderId = null;
    document.getElementById('ord-form-title').textContent = 'Регистрация нового документа';
    document.getElementById('ord-child-block').classList.add('hidden');
    document.getElementById('ord-parent-id').value = '';
    const hint2 = document.getElementById('ord-number-hint');
    if (hint2) hint2.classList.add('hidden');
    document.getElementById('ord-parent-number-display').value = '';
    document.getElementById('ord-noncompliance-reason').value = '';
    document.getElementById('ord-parent-ref').textContent = '';
    document.querySelectorAll('#section-orders input[type="text"], #section-orders input[type="date"], #section-orders input[type="url"]').forEach(i => i.value = '');
    document.getElementById('ord-description').value = '';
    document.getElementById('ord-status').value = 'В работе';
    document.getElementById('ord-link').value = '';
}

window.onload = function() {
    initDynamicPeriods();
    setupListeners();
    createCharts();
    document.querySelector('.nav-link[data-target="section-main"]').click();
    filterAndRenderRegister();
};

async function exportOrdersToExcel() {
    if (!db.orders || db.orders.length === 0) {
        alert('Нет данных для выгрузки');
        return;
    }

    const now = new Date();
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Реестр предписаний');

    sheet.columns = [
        { width: 5  }, // A: Тип
        { width: 20 }, // B: №
        { width: 15 }, // C: Дата получения
        { width: 50 }, // D: Суть запроса
        { width: 15 }, // E: Дедлайн
        { width: 20 }, // F: Ответственный
        { width: 20 }, // G: Статус
        { width: 15 }, // H: Дата исполнения
        { width: 30 }, // I: Ссылка
        { width: 20 }, // J: Родительский №
        { width: 40 }  // K: Причина неисполнения
    ];

    const headerRow = sheet.getRow(1);
    headerRow.values = [
        "Тип", "Вх. №", "Дата получения", "Суть запроса",
        "Дедлайн", "Ответственный", "Статус", "Дата исп.",
        "Ссылка на документ", "Родительский №", "Причина неисполнения"
    ];
    headerRow.eachCell((cell) => {
        cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4B4240' } };
        cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    });
    headerRow.height = 30;

    // Та же сортировка что и в таблице
    const parentsXls = db.orders.filter(o => !o.parentId).sort((a, b) => {
        const aNotDone = a.status === 'Не исполнено' ? 0 : 1;
        const bNotDone = b.status === 'Не исполнено' ? 0 : 1;
        if (aNotDone !== bNotDone) return aNotDone - bNotDone;
        return new Date(a.deadline) - new Date(b.deadline);
    });
    const sorted = [];
    parentsXls.forEach(p => {
        sorted.push(p);
        const children = db.orders.filter(o => o.parentId === p.id);
        children.forEach(c => sorted.push(c));
    });

    sorted.forEach(ord => {
        const isChild = !!ord.parentId;
        const parent = isChild ? db.orders.find(o => o.id === ord.parentId) : null;

        const row = sheet.addRow([
            isChild ? '⤷ Дочернее' : 'Основное',
            ord.number,
            ord.dateIn,
            ord.description,
            ord.deadline,
            ord.responsible || '-',
            ord.status,
            ord.dateDone || '-',
            ord.link || '-',
            parent ? parent.number : '-',
            ord.nonComplianceReason || '-'
        ]);

        // Подсветка типа
        const typeCell = row.getCell(1);
        if (isChild) {
            typeCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE3F2FD' } };
            typeCell.font = { color: { argb: 'FF1565C0' }, bold: true };
            // Голубой фон всей строки
            row.eachCell({ includeEmpty: true }, (cell) => {
                if (!cell.fill || cell.fill.fgColor?.argb === 'FFFFFFFF') {
                    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF3F8FF' } };
                }
            });
        }

        // Подсветка статуса
        const statusCell = row.getCell(7);
        if (ord.status === 'Исполнено') {
            statusCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8F5E9' } };
            statusCell.font = { color: { argb: 'FF2E7D32' }, bold: true };
        } else if (ord.status === 'Не исполнено') {
            statusCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFCDD2' } };
            statusCell.font = { color: { argb: 'FFB71C1C' }, bold: true };
        } else if (ord.status === 'Просрочено' || (ord.deadline < now.toISOString().split('T')[0] && !['Отправлено','Исполнено','Не исполнено'].includes(ord.status))) {
            statusCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFCDD2' } };
            statusCell.font = { color: { argb: 'FFB71C1C' }, bold: true };
        }

        // Подсветка причины неисполнения
        if (ord.nonComplianceReason) {
            const reasonCell = row.getCell(11);
            reasonCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF3E0' } };
        }

        row.eachCell({ includeEmpty: true }, (cell) => {
            cell.border = { top: {style:'thin'}, left: {style:'thin'}, bottom: {style:'thin'}, right: {style:'thin'} };
            cell.alignment = { vertical: 'top', wrapText: true };
        });
        row.getCell(1).alignment = { vertical: 'top', horizontal: 'center', wrapText: true };
        row.getCell(7).alignment = { vertical: 'top', horizontal: 'center', wrapText: true };
    });

    const buffer = await workbook.xlsx.writeBuffer();
    saveAs(new Blob([buffer]), `Orders_Register_${now.toISOString().split('T')[0]}.xlsx`);
}

// =============================================
// ФИНАНСОВЫЕ ПОКАЗАТЕЛИ: НКД, НКЛ, СОБСТВЕННЫЕ СРЕДСТВА
// =============================================
