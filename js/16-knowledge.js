// ============================================================
// МОДУЛЬ 16: СПРАВОЧНИК ТЕРМИНОВ (База знаний)
// ============================================================
// renderKnowledgeItems()       — отрисовать список терминов
// saveKnowledgeItem()          — добавить / сохранить термин
// editKnowledgeItem(id)        — заполнить форму для редактирования
// deleteKnowledgeItem(id)      — удалить термин
// cancelKnowledgeEdit()        — отменить редактирование
// ============================================================

let _editingKnowledgeId = null;

function renderKnowledgeItems() {
    const list = document.getElementById('knowledge-info-list');
    if (!list) return;

    const items = db.knowledgeItems || [];

    if (items.length === 0) {
        list.innerHTML = '<p class="text-sm text-[#A69C97] italic">Термины не добавлены. Используйте форму выше.</p>';
        return;
    }

    list.innerHTML = items.map(item => `
        <div class="knowledge-info-item p-4 rounded-lg bg-[#FDFBF8] border border-[#E0D9D4] group relative" data-info-id="${item.id}">
            <div class="flex justify-between items-start gap-3">
                <h4 class="font-semibold text-[#4B4240] mb-1 flex-1">${escapeHtml(item.title)}</h4>
                <div class="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                    <button onclick="editKnowledgeItem(${item.id})"
                        class="text-blue-400 hover:text-blue-600 text-sm px-2 py-1 rounded hover:bg-blue-50 transition" title="Редактировать">✏️</button>
                    <button onclick="deleteKnowledgeItem(${item.id})"
                        class="text-red-400 hover:text-red-600 text-sm px-2 py-1 rounded hover:bg-red-50 transition" title="Удалить">🗑️</button>
                </div>
            </div>
            <p class="text-sm text-[#7D7471] knowledge-item-body">${escapeHtml(item.body)}</p>
        </div>
    `).join('');
}

function escapeHtml(str) {
    return String(str || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function saveKnowledgeItem() {
    const titleEl = document.getElementById('ki-title');
    const bodyEl  = document.getElementById('ki-body');
    const title = titleEl?.value.trim();
    const body  = bodyEl?.value.trim();

    if (!title || !body) {
        alert('Заполните название и текст термина.');
        return;
    }

    if (!db.knowledgeItems) db.knowledgeItems = [];

    if (_editingKnowledgeId !== null) {
        const idx = db.knowledgeItems.findIndex(x => x.id === _editingKnowledgeId);
        if (idx !== -1) {
            db.knowledgeItems[idx] = { ...db.knowledgeItems[idx], title, body };
        }
        _editingKnowledgeId = null;
    } else {
        const newId = db.knowledgeItems.length > 0
            ? Math.max(...db.knowledgeItems.map(x => x.id)) + 1
            : 1;
        db.knowledgeItems.push({ id: newId, title, body });
    }

    saveDb();
    cancelKnowledgeEdit();
    renderKnowledgeItems();
}

function editKnowledgeItem(id) {
    const item = (db.knowledgeItems || []).find(x => x.id === id);
    if (!item) return;

    _editingKnowledgeId = id;

    document.getElementById('ki-title').value = item.title;
    document.getElementById('ki-body').value  = item.body;

    // Переключить кнопку и заголовок
    const btn = document.getElementById('ki-save-btn');
    if (btn) btn.textContent = '💾 Сохранить изменения';
    const formTitle = document.getElementById('ki-form-title');
    if (formTitle) formTitle.textContent = 'Редактирование термина';
    const cancelBtn = document.getElementById('ki-cancel-btn');
    if (cancelBtn) cancelBtn.classList.remove('hidden');

    // Прокрутить к форме
    document.getElementById('ki-title')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    document.getElementById('ki-title')?.focus();
}

function deleteKnowledgeItem(id) {
    const item = (db.knowledgeItems || []).find(x => x.id === id);
    if (!item) return;
    if (!confirm(`Удалить термин «${item.title}»?`)) return;
    db.knowledgeItems = db.knowledgeItems.filter(x => x.id !== id);
    saveDb();
    renderKnowledgeItems();
}

function cancelKnowledgeEdit() {
    _editingKnowledgeId = null;
    const titleEl = document.getElementById('ki-title');
    const bodyEl  = document.getElementById('ki-body');
    if (titleEl) titleEl.value = '';
    if (bodyEl)  bodyEl.value  = '';
    const btn = document.getElementById('ki-save-btn');
    if (btn) btn.textContent = '+ Добавить термин';
    const formTitle = document.getElementById('ki-form-title');
    if (formTitle) formTitle.textContent = 'Добавить термин';
    const cancelBtn = document.getElementById('ki-cancel-btn');
    if (cancelBtn) cancelBtn.classList.add('hidden');
}
