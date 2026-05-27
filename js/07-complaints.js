// ============================================================
// МОДУЛЬ 07: ЖАЛОБЫ / ОБРАЩЕНИЯ
// ============================================================
// saveComplaint()    — добавить обращение
// deleteComplaint()  — удалить
// renderComplaints() — отрисовать таблицу
// ============================================================

function saveComplaint() {
    const date = document.getElementById('cmp-date').value;
    const description = document.getElementById('cmp-description').value;
    if (!date || !description) {
        alert('Укажите дату получения и суть обращения!');
        return;
    }
    const newComplaint = {
        id: Date.now(),
        date,
        deadline: document.getElementById('cmp-deadline').value,
        channel: document.getElementById('cmp-channel').value,
        description,
        riskDetected: document.getElementById('cmp-risk').value,
        responsible: document.getElementById('cmp-responsible').value,
        status: document.getElementById('cmp-status').value,
        result: document.getElementById('cmp-result').value
    };
    db.complaints.push(newComplaint);
    localStorage.setItem('controllerDataV3', JSON.stringify(db));
    document.getElementById('cmp-date').value = '';
    document.getElementById('cmp-deadline').value = '';
    document.getElementById('cmp-description').value = '';
    document.getElementById('cmp-responsible').value = '';
    document.getElementById('cmp-result').value = '';
    renderComplaints();
}

function deleteComplaint(id) {
    if (confirm('Удалить запись об обращении?')) {
        db.complaints = db.complaints.filter(c => c.id !== id);
        localStorage.setItem('controllerDataV3', JSON.stringify(db));
        renderComplaints();
    }
}

function renderComplaints() {
    const tbody = document.getElementById('complaints-table-body');
    if (!tbody) return;
    tbody.innerHTML = '';
    const today = new Date().toISOString().split('T')[0];
    
    const list = [...(db.complaints || [])].sort((a,b) => new Date(b.date) - new Date(a.date));
    
    let countActive = 0, countOverdue = 0;
    
    if (list.length === 0) {
        tbody.innerHTML = '<tr><td colspan="9" class="p-8 text-center text-[#A69C97] italic">Обращений не зафиксировано</td></tr>';
    }
    
    list.forEach(c => {
        const isOverdue = c.deadline && c.deadline < today && c.status !== 'Рассмотрено';
        if (c.status !== 'Рассмотрено') countActive++;
        if (isOverdue) countOverdue++;
        
        const row = document.createElement('tr');
        row.className = `border-b ${isOverdue ? 'bg-red-50' : 'hover:bg-gray-50'}`;
        row.setAttribute('data-row-id', c.id);
        
        let statusCls = 'bg-yellow-100 text-yellow-800';
        if (c.status === 'Рассмотрено') statusCls = 'bg-green-100 text-green-800';
        if (c.status === 'Направлено в ЦБ/СРО') statusCls = 'bg-blue-100 text-blue-800';
        
        let riskCls = 'text-gray-500';
        if (c.riskDetected === 'Да') riskCls = 'text-red-600 font-bold';
        if (c.riskDetected === 'На оценке') riskCls = 'text-orange-500';
        
        const deadlineHtml = c.deadline 
            ? (isOverdue ? `<span class="text-red-600 font-bold">⚠ ${c.deadline}</span>` : c.deadline)
            : '—';
        
        row.innerHTML = `
            <td class="p-3 text-sm">${c.date}</td>
            <td class="p-3 text-sm">${deadlineHtml}</td>
            <td class="p-3 text-sm" title="${c.description}">${c.description.length > 35 ? c.description.substring(0,35)+'...' : c.description}</td>
            <td class="p-3 text-sm text-gray-600">${c.channel}</td>
            <td class="p-3 text-sm ${riskCls}">${c.riskDetected}</td>
            <td class="p-3 text-sm">${c.responsible || '—'}</td>
            <td class="p-3"><span class="px-2 py-1 rounded text-xs ${statusCls}">${c.status}</span></td>
            <td class="p-3 text-sm text-gray-600">${c.result || '—'}</td>
            <td class="p-3 text-center">
                <button onclick="deleteComplaint(${c.id})" class="text-red-400 hover:text-red-600 text-sm">Удалить</button>
            </td>
        `;
        tbody.appendChild(row);
    });
    
    const total = list.length;
    const elTotal = document.getElementById('cmp-count-total');
    const elActive = document.getElementById('cmp-count-active');
    const elOverdue = document.getElementById('cmp-count-overdue');
    if (elTotal) elTotal.textContent = total;
    if (elActive) elActive.textContent = countActive;
    if (elOverdue) elOverdue.textContent = countOverdue;
}

// =============================================
// ТЁМНАЯ ТЕМА
// =============================================
