// ============================================================
// МОДУЛЬ 04: РЕЕСТР СОБЫТИЙ РЕГУЛЯТОРНОГО РИСКА
// ============================================================
// filterAndRenderRegister() — фильтры + рендер таблицы
// renderRiskRegister()      — рендер таблицы
// resetForm()               — очистить форму
// saveRiskEvent()           — добавить / сохранить
// updateEventStatus()       — сменить статус
// showDeleteModal/hide/confirmDelete — модалка удаления
// editEvent(id)             — заполнить форму для редакт.
// exportToExcelFormatted()  — XLSX выгрузка реестра
// ============================================================

function filterAndRenderRegister() {
    const statusFilter = document.getElementById('filter-status')?.value || '';
    const substantialFilter = document.getElementById('filter-substantial')?.value || '';
    const taxonomyFilter = document.getElementById('filter-taxonomy')?.value || '';
    const searchFilter = (document.getElementById('filter-search')?.value || '').toLowerCase();
    
    const today = new Date().toISOString().split('T')[0];
    
    let filtered = db.events.filter(event => {
        // Статус (включая просрочено)
        if (statusFilter === 'Просрочено') {
            const isOverdue = event.deadline && event.deadline < today && event.status !== 'Устранено';
            if (!isOverdue) return false;
        } else if (statusFilter && event.status !== statusFilter) {
            return false;
        }
        // Существенность
        if (substantialFilter === 'true' && !event.isSubstantial) return false;
        if (substantialFilter === 'false' && event.isSubstantial) return false;
        // Таксономия
        if (taxonomyFilter && !event.classification.startsWith(taxonomyFilter)) return false;
        // Поиск
        if (searchFilter && !event.description.toLowerCase().includes(searchFilter)) return false;
        return true;
    });

    renderRiskRegister(filtered);
}

function renderRiskRegister(eventsToRender) {
    const tableBody = document.getElementById('risk-register-table');
    tableBody.innerHTML = '';
    
    const today = new Date().toISOString().split('T')[0];
    const events = eventsToRender || db.events;
    
    if (events.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="13" class="p-8 text-center text-[#A69C97] italic">Нет данных для отображения</td></tr>';
        return;
    }
    
    events.sort((a, b) => new Date(b.date) - new Date(a.date)).forEach(event => {
        const row = document.createElement('tr');
        
        // Просрочено?
        const isOverdue = event.deadline && event.deadline < today && event.status !== 'Устранено';
        row.className = isOverdue ? 'border-b border-[#E0E0E0] bg-red-50' : 'border-b border-[#E0E0E0]';
        row.setAttribute('data-row-id', event.id);
        
        const statusOptions = ['Выявлено', 'В работе', 'Устранено']
            .map(s => `<option value="${s}" ${s === event.status ? 'selected' : ''}>${s}</option>`)
            .join('');
        
        let statusColor = '';
        if (event.status === 'Выявлено') statusColor = 'bg-red-100 text-red-700';
        else if (event.status === 'В работе') statusColor = 'bg-yellow-100 text-yellow-700';
        else if (event.status === 'Устранено') statusColor = 'bg-green-100 text-green-700';

        let ratingColor = 'bg-gray-100 text-gray-800';
        const r = parseInt(event.riskRating || 1);
        if (r === 3) ratingColor = 'bg-yellow-100 text-yellow-800';
        if (r >= 4) ratingColor = 'bg-red-100 text-red-800 font-bold';
        
        const shortClassification = event.classification.length > 35 ? event.classification.substring(0, 35) + '...' : event.classification;
        
        const deadlineDisplay = event.deadline 
            ? (isOverdue ? `<span class="text-red-600 font-bold">⚠ ${event.deadline}</span>` : event.deadline)
            : '<span class="text-gray-400">—</span>';

        row.innerHTML = `
            <td class="p-3 text-sm whitespace-nowrap font-bold text-[#4B4240]">${event.eventDate || '-'}</td>
            <td class="p-3 text-sm whitespace-nowrap text-gray-500">${event.date}</td>
            <td class="p-3" title="${event.description}">${event.description.length > 30 ? event.description.substring(0, 30) + '...' : event.description}</td>
            <td class="p-3 text-sm text-[#7D7471]" title="${event.classification}">${shortClassification}</td>
            <td class="p-3 text-sm font-bold ${event.isSubstantial ? 'text-red-500' : 'text-gray-400'}">${event.isSubstantial ? 'Да' : 'Нет'}</td>
            <td class="p-3 text-center">
                <span class="px-2 py-1 rounded text-xs ${ratingColor}">${event.riskRating || '1'}</span>
            </td>
            <td class="p-3">
                <select data-id="${event.id}" onchange="updateEventStatus(this)" class="p-1 border border-[#A69C97] rounded text-sm ${statusColor}">
                    ${statusOptions}
                </select>
            </td>
            <td class="p-3 text-sm">${deadlineDisplay}</td>
            <td class="p-3 text-sm text-[#7D7471]">${event.responsible || '—'}</td>
            <td class="p-3 text-sm text-center font-bold text-[#4B4240]">${event.hasOrder || 'Нет'}</td>
            <td class="p-3 text-xs text-[#7D7471]">${event.measures ? (event.measures.length > 20 ? event.measures.substring(0, 20) + '...' : event.measures) : '-'}</td>
            <td class="p-3 text-xs text-[#7D7471]">${event.orderMark === 'Исполнено' ? '✅ ' + (event.orderDate || '') : event.orderMark || '-'}</td>
            <td class="p-3 text-xs text-center">
                <span class="px-2 py-0.5 rounded-full font-semibold ${
                    event.recurrence === 'Высокая' ? 'bg-red-100 text-red-700' :
                    event.recurrence === 'Средняя' ? 'bg-yellow-100 text-yellow-700' :
                    event.recurrence === 'Низкая' ? 'bg-green-100 text-green-700' :
                    'bg-gray-100 text-gray-500'
                }">${event.recurrence || '—'}</span>
            </td>
            <td class="p-3 text-center whitespace-nowrap">
                <button onclick="editEvent(${event.id})" class="text-blue-500 hover:text-blue-700 text-lg mr-3" title="Редактировать">&#9998;</button>
                <button data-id="${event.id}" onclick="showDeleteModal(this)" class="text-red-500 hover:text-red-700 text-lg" title="Удалить">&#128465;</button>
            </td>
        `;
        tableBody.appendChild(row);
    });
}
        
        function resetForm() {
    editingEventId = null;
    document.getElementById('btn-save').textContent = 'Добавить в реестр';
    document.getElementById('btn-cancel').classList.add('hidden');
    
    document.getElementById('reg-event-date').value = '';
    document.getElementById('reg-has-order').value = 'Нет';
    document.getElementById('reg-risk-rating').value = '1';
    document.getElementById('reg-date').value = '';
    document.getElementById('reg-source').value = 'Внутренняя проверка';
    document.getElementById('reg-description').value = '';
    document.getElementById('reg-substantial').checked = false;
    document.getElementById('reg-measures').value = '';
    document.getElementById('reg-measures-done').value = 'Нет';
    document.getElementById('reg-remedy-mark').value = 'Нет';
    document.getElementById('reg-remedy-date').value = '';
    document.getElementById('reg-responsible').value = '';
    document.getElementById('reg-deadline').value = '';
    document.getElementById('reg-prevention-mark').value = 'Нет';
    document.getElementById('reg-prevention-date').value = '';
    document.getElementById('reg-order-mark').value = 'Не применимо';
    document.getElementById('reg-order-date').value = '';
    const recEl = document.getElementById('reg-recurrence');
    if (recEl) recEl.value = 'Не оценена';
}

function saveRiskEvent() {
    const eventDate = document.getElementById('reg-event-date').value || '-';
    const hasOrder = document.getElementById('reg-has-order').value;
    const riskRating = document.getElementById('reg-risk-rating').value;
    const date = document.getElementById('reg-date').value;
    const source = document.getElementById('reg-source').value;
    const description = document.getElementById('reg-description').value;
    const classificationSelect = document.getElementById('reg-taxonomy');
    const classification = classificationSelect.options[classificationSelect.selectedIndex].text;
    const isSubstantial = document.getElementById('reg-substantial').checked;
    const measures = document.getElementById('reg-measures').value || '-';
    const measuresDone = document.getElementById('reg-measures-done').value;
    const remedyMark = document.getElementById('reg-remedy-mark').value;
    const remedyDate = document.getElementById('reg-remedy-date').value || '-';
    const responsible = document.getElementById('reg-responsible').value || '';
    const deadline = document.getElementById('reg-deadline').value || '';
    const preventionMark = document.getElementById('reg-prevention-mark').value;
    const preventionDate = document.getElementById('reg-prevention-date').value || '-';
    const orderMark = document.getElementById('reg-order-mark').value;
    const orderDate = document.getElementById('reg-order-date').value || '-';
    const recurrence = document.getElementById('reg-recurrence')?.value || 'Не оценена';

    if (!date || !description) {
        alert('Пожалуйста, заполните дату регистрации и описание.');
        return;
    }

    if (editingEventId !== null) {
        const eventIndex = db.events.findIndex(e => e.id === editingEventId);
        if (eventIndex > -1) {
            db.events[eventIndex] = {
                ...db.events[eventIndex],
                eventDate, hasOrder, riskRating,
                date, source, description, classification, isSubstantial,
                measures, measuresDone, remedyMark, remedyDate,
                responsible, deadline,
                preventionMark, preventionDate, orderMark, orderDate, recurrence
            };
        }
    } else {
        const newEvent = {
            id: (db.events.length > 0 ? Math.max(...db.events.map(e => e.id)) : 0) + 1,
            eventDate, hasOrder, riskRating,
            date, description, source, classification, isSubstantial, status: 'Выявлено',
            measures, measuresDone, remedyMark, remedyDate,
            responsible, deadline,
            preventionMark, preventionDate, orderMark, orderDate, recurrence
        };
        db.events.push(newEvent);
    }

    localStorage.setItem('controllerDataV3', JSON.stringify(db));
    filterAndRenderRegister();
    updateMetrics();
    updateReportCharts();
    resetForm();
}
        
        function updateEventStatus(selectElement) {
            const eventId = parseInt(selectElement.dataset.id);
            const newStatus = selectElement.value;
            
            const event = db.events.find(e => e.id === eventId);
            if (event) {
                event.status = newStatus;
                localStorage.setItem('controllerDataV3', JSON.stringify(db));
                filterAndRenderRegister();
                updateMetrics();
            }
        }
        
        function showDeleteModal(buttonElement) {
            eventIdToDelete = parseInt(buttonElement.dataset.id);
            const modal = document.getElementById('delete-modal');
            
            modal.querySelector('h2').textContent = 'Подтвердить удаление';
            modal.querySelector('p').textContent = 'Вы уверены, что хотите удалить это событие из реестра? Это действие нельзя отменить.';
            modal.querySelector('#modal-confirm-btn').classList.remove('hidden');
            modal.querySelector('#modal-cancel-btn').textContent = 'Отмена';
            modal.querySelector('#modal-cancel-btn').onclick = hideDeleteModal;
            modal.querySelector('#modal-confirm-btn').onclick = confirmDelete;

            modal.classList.remove('hidden');
        }

        function hideDeleteModal() {
            eventIdToDelete = null;
            document.getElementById('delete-modal').classList.add('hidden');
        }

        function confirmDelete() {
            if (eventIdToDelete !== null) {
                db.events = db.events.filter(e => e.id !== eventIdToDelete);
                localStorage.setItem('controllerDataV3', JSON.stringify(db));
                filterAndRenderRegister();
                updateMetrics();
                updateReportCharts();
            }
            hideDeleteModal();
        }
        
        // --- ФУНКЦИОНАЛ УПРАВЛЕНИЯ ССЫЛКАМИ ---

function renderExternalLinks() {
    const listElement = document.getElementById('external-links-list');
    if (!listElement) return;

    listElement.innerHTML = '';
    
    // Сортировка по ID, чтобы новые ссылки всегда были в конце
    db.externalLinks.sort((a, b) => a.id - b.id);

    db.externalLinks.forEach(link => {
        const listItem = document.createElement('li');
        listItem.id = `ext-link-${link.id}`;
        listItem.className = 'flex justify-between items-center';
        
        listItem.innerHTML = `
            <a href="${link.url}" target="_blank" class="text-blue-600 hover:underline flex-grow mr-4">${link.title}</a>
            <button onclick="deleteExternalLink(${link.id})" class="text-red-500 hover:text-red-700 text-sm font-bold p-1 rounded-full leading-none" title="Удалить ссылку">
                &times;
            </button>
        `;
        listElement.appendChild(listItem);
    });
}

function addExternalLink() {
    const title = document.getElementById('link-title').value.trim();
    const url = document.getElementById('link-url').value.trim();

    if (!title || !url) {
        alert('Пожалуйста, заполните и название, и URL ссылки.');
        return;
    }
    
    // Проверка на базовый формат URL
    if (!url.startsWith('http')) {
        alert('Пожалуйста, введите полный URL, включая http:// или https://');
        return;
    }

    const newId = (db.externalLinks.length > 0 ? Math.max(...db.externalLinks.map(l => l.id)) : 0) + 1;
    
    const newLink = {
        id: newId,
        title: title,
        url: url
    };

    db.externalLinks.push(newLink);
    db = JSON.parse(JSON.stringify(db));
    localStorage.setItem('controllerDataV3', JSON.stringify(db));

    // Очистка полей и перерисовка
    document.getElementById('link-title').value = '';
    document.getElementById('link-url').value = '';
    
    renderExternalLinks();
}

function deleteExternalLink(id) {
    if (confirm('Вы уверены, что хотите удалить эту ссылку?')) {
        db.externalLinks = db.externalLinks.filter(link => link.id !== id);
        db = JSON.parse(JSON.stringify(db));
        localStorage.setItem('controllerDataV3', JSON.stringify(db));
        renderExternalLinks();
    }
}
function editEvent(id) {
    const event = db.events.find(e => e.id === id);
    if (!event) return;

    editingEventId = id;

    document.getElementById('reg-event-date').value = event.eventDate || '';
    document.getElementById('reg-has-order').value = event.hasOrder || 'Нет';
    document.getElementById('reg-risk-rating').value = event.riskRating || '1';
    document.getElementById('reg-date').value = event.date;
    document.getElementById('reg-source').value = event.source;
    document.getElementById('reg-description').value = event.description;
    
    const taxonomySelect = document.getElementById('reg-taxonomy');
    for (let i = 0; i < taxonomySelect.options.length; i++) {
        if (taxonomySelect.options[i].text === event.classification) {
            taxonomySelect.selectedIndex = i;
            break;
        }
    }

    document.getElementById('reg-substantial').checked = event.isSubstantial;
    document.getElementById('reg-measures').value = event.measures !== '-' ? event.measures : '';
    document.getElementById('reg-measures-done').value = event.measuresDone || 'Нет';
    document.getElementById('reg-remedy-mark').value = event.remedyMark || 'Нет';
    document.getElementById('reg-remedy-date').value = event.remedyDate !== '-' ? event.remedyDate : '';
    document.getElementById('reg-responsible').value = event.responsible || '';
    document.getElementById('reg-deadline').value = event.deadline || '';
    document.getElementById('reg-prevention-mark').value = event.preventionMark || 'Нет';
    document.getElementById('reg-prevention-date').value = event.preventionDate !== '-' ? event.preventionDate : '';
    document.getElementById('reg-order-mark').value = event.orderMark || 'Не применимо';
    document.getElementById('reg-order-date').value = event.orderDate !== '-' ? event.orderDate : '';
    const recEl = document.getElementById('reg-recurrence');
    if (recEl) recEl.value = event.recurrence || 'Не оценена';

    document.getElementById('btn-save').textContent = 'Сохранить изменения';
    document.getElementById('btn-cancel').classList.remove('hidden');
    
    document.getElementById('section-register').scrollIntoView({ behavior: 'smooth' });
}
async function exportToExcelFormatted() {
    const now = new Date();
    const dateTimeString = now.toLocaleString('ru-RU', { 
        year: 'numeric', month: 'long', day: 'numeric', 
        hour: '2-digit', minute: '2-digit' 
    });

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Реестр Рисков');

    // 1. НАСТРОЙКА ШИРИНЫ КОЛОНОК (ТЕПЕРЬ 20 КОЛОНОК)
    sheet.columns = [
        { width: 5 },  // A: ID
        { width: 15 }, // B: Дата События
        { width: 15 }, // C: Дата Регистрации
        { width: 25 }, // D: Источник
        { width: 50 }, // E: Описание
        { width: 35 }, // F: Таксономия
        { width: 15 }, // G: Существенное
        { width: 10 }, // H: Рейтинг
        { width: 15 }, // I: Статус
        { width: 15 }, // J: Наличие предписания
        { width: 20 }, // K: Ответственный (НОВОЕ)
        { width: 15 }, // L: Дедлайн (НОВОЕ)
        { width: 35 }, // M: Мероприятия
        { width: 20 }, // N: Реал. мер
        { width: 20 }, // O: Устранение
        { width: 15 }, // P: Дата устр
        { width: 20 }, // Q: Предотвр
        { width: 15 }, // R: Дата пред
        { width: 20 }, // S: Предписания (исп)
        { width: 15 }  // T: Дата исп
    ];

    // 2. ЗАГОЛОВОК (Объединяем A1:T1)
    sheet.mergeCells('A1:T1'); 
    const titleCell = sheet.getCell('A1');
    titleCell.value = `Реестр Рисков. Дата выгрузки: ${dateTimeString}`;
    titleCell.font = { name: 'Arial', size: 16, bold: true };
    titleCell.alignment = { vertical: 'middle', horizontal: 'center' };
    sheet.getRow(1).height = 30;

    // 3. ШАПКА ТАБЛИЦЫ (Строка 3)
    const headerRow = sheet.getRow(3);
    headerRow.values = [
        "ID", 
        "Дата события",
        "Дата регистрации", 
        "Источник", 
        "Описание события", 
        "Таксономия", 
        "Существенное", 
        "Рейтинг",
        "Статус",
        "Наличие предписания",
        "Ответственный",
        "Срок устранения",
        "Мероприятия", 
        "Реализация мер", 
        "Устранение (Отметка)", 
        "Дата устранения",
        "Предотвращение повторов", 
        "Дата принятия мер",
        "Исполнение предписаний", 
        "Дата исполнения"
    ];

    // Стилизация шапки
    headerRow.eachCell((cell) => {
        cell.font = { bold: true };
        cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
        cell.border = { top: {style:'thin'}, left: {style:'thin'}, bottom: {style:'thin'}, right: {style:'thin'} };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEFEFEF' } };
    });
    headerRow.height = 40; 

    // 4. ДАННЫЕ (Строки 4+)
    const sortedEvents = db.events.sort((a, b) => new Date(b.date) - new Date(a.date));

    sortedEvents.forEach(e => {
        const rowData = [
            e.id, 
            e.eventDate || '-',
            e.date, 
            e.source, 
            e.description, 
            e.classification, 
            e.isSubstantial ? "Да" : "Нет", 
            e.riskRating || '1',
            e.status,
            e.hasOrder || 'Нет',
            e.responsible || '-',
            e.deadline || '-',
            e.measures || '-', 
            e.measuresDone || '-', 
            e.remedyMark || '-',
            e.remedyDate || '-', 
            e.preventionMark || '-', 
            e.preventionDate || '-',
            e.orderMark || '-', 
            e.orderDate || '-'
        ];
        
        const row = sheet.addRow(rowData);

        // --- ЛОГИКА РАСКРАШИВАНИЯ (ИНДЕКСЫ СДВИНУЛИСЬ!) --- //
        
        // 1. Источник (Теперь Колонка 4 / D)
        const sourceCell = row.getCell(4);
        let sourceColor = 'FFFFFFFF'; 
        if (e.source === 'Внутренняя проверка') sourceColor = 'FFE3F2FD';
        else if (e.source === 'Жалоба клиента') sourceColor = 'FFF3E5F5';
        else if (e.source === 'Запрос ЦБ/СРО') sourceColor = 'FFFFF3E0';
        else sourceColor = 'FFF5F5F5';
        sourceCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: sourceColor } };

        // 2. Существенное (Теперь Колонка 7 / G)
        const substCell = row.getCell(7);
        if (e.isSubstantial) {
            substCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFCDD2' } };
            substCell.font = { color: { argb: 'FFB71C1C' }, bold: true };
        }

        // 3. Рейтинг (НОВАЯ КОЛОНКА 8 / H)
        const ratingCell = row.getCell(8);
        const rVal = parseInt(e.riskRating || 1);
        if(rVal >= 4) {
             ratingCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFCDD2' } }; // Красный фон
             ratingCell.font = { color: { argb: 'FFB71C1C' }, bold: true }; // Красный текст
        } else if (rVal === 3) {
             ratingCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF9C4' } }; // Желтый фон
        }
        ratingCell.alignment = { horizontal: 'center', vertical: 'top' };

        // 4. Статус (Теперь Колонка 9 / I)
        const statusCell = row.getCell(9);
        let statusBg = 'FFFFFFFF';
        let statusText = 'FF000000';

        if (e.status === 'Выявлено') {
            statusBg = 'FFFFEBEE'; statusText = 'FFC62828';
        } else if (e.status === 'В работе') {
            statusBg = 'FFFFF8E1'; statusText = 'FFF57F17';
        } else if (e.status === 'Устранено') {
            statusBg = 'FFE8F5E9'; statusText = 'FF2E7D32';
        }

        statusCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: statusBg } };
        statusCell.font = { color: { argb: statusText }, bold: true };

        // 5. Общие границы и выравнивание
        row.eachCell({ includeEmpty: true }, (cell) => {
            cell.alignment = { vertical: 'top', wrapText: true, horizontal: 'left' };
            cell.border = { top: {style:'thin'}, left: {style:'thin'}, bottom: {style:'thin'}, right: {style:'thin'} };
        });
        
        // Центрирование узких колонок (ID, Даты, Рейтинг, Статус, Предписания, Дедлайн)
        // Индексы: 1(ID), 2(EvDate), 3(RegDate), 7(Subst), 8(Rating), 9(Status), 10(HasOrder), 12(Deadline)
        [1, 2, 3, 7, 8, 9, 10, 12].forEach(idx => {
            row.getCell(idx).alignment = { vertical: 'top', horizontal: 'center', wrapText: true };
        });
    });

    // 5. СОХРАНЕНИЕ
    const buffer = await workbook.xlsx.writeBuffer();
    const fileName = `Risk_Register_${now.toISOString().split('T')[0]}.xlsx`;
    saveAs(new Blob([buffer]), fileName);
}
// --- ФУНКЦИОНАЛ BACKUP / RESTORE ---

