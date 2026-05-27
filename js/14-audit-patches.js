// ============================================================
// МОДУЛЬ 14: ПЕРЕХВАТЧИКИ АУДИТА
// ============================================================
// Оборачивает функции из других модулей,
// добавляя запись в лог аудита к каждому действию.
// Этот файл подключается ПОСЛЕ 12-audit.js.
//
// КАК ДОБАВИТЬ АУДИТ К НОВОЙ ФУНКЦИИ:
// const _origMyFunc = myFunc;
// myFunc = function(...args) {
//     const before = ...;
//     _origMyFunc(...args);
//     writeAudit({ section: 'Раздел', action: 'Действие', ... });
//     saveDb();
// };
// ============================================================

const _origSaveRiskEvent = saveRiskEvent;
saveRiskEvent = function() {
    const savedEditId = editingEventId;
    const isEdit = savedEditId !== null;

    // Полный снапшот всех полей формы
    function snapEvent(e) {
        return {
            description:    e.description,
            eventDate:      e.eventDate || '—',
            date:           e.date || '—',
            source:         e.source || '—',
            riskRating:     String(e.riskRating),
            classification: e.classification,
            isSubstantial:  e.isSubstantial ? 'Да' : 'Нет',
            responsible:    e.responsible || '—',
            deadline:       e.deadline || '—',
            status:         e.status || '—',
            measures:       (e.measures && e.measures !== '-' ? e.measures : '—').slice(0, 80),
            measuresDone:   e.measuresDone || '—',
            remedyMark:     e.remedyMark || '—',
            remedyDate:     e.remedyDate || '—',
            preventionMark: e.preventionMark || '—',
            preventionDate: e.preventionDate || '—',
            orderMark:      e.orderMark || '—',
            orderDate:      e.orderDate || '—',
            hasOrder:       e.hasOrder || 'Нет',
            recurrence:     e.recurrence || 'Не оценена',
        };
    }

    const FIELD_LABELS = {
        description:'Описание', eventDate:'Дата события', date:'Дата обнаружения',
        source:'Источник', riskRating:'Рейтинг риска', classification:'Таксономия',
        isSubstantial:'Существенное', responsible:'Ответственный', deadline:'Дедлайн',
        status:'Статус', measures:'Мероприятия', measuresDone:'Реализация мероприятий',
        remedyMark:'Отметка об устранении', remedyDate:'Дата устранения',
        preventionMark:'Меры предотвр. повторов', preventionDate:'Дата принятия мер',
        orderMark:'Исполнение предписаний', orderDate:'Дата исполнения',
        hasOrder:'Наличие предписания', recurrence:'Вероятность повторения',
    };

    let oldSnap = null;
    if (isEdit) {
        const old = db.events.find(e => e.id === savedEditId);
        if (old) oldSnap = snapEvent(old);
    }

    const prevLen = db.events.length;
    _origSaveRiskEvent();
    const newLen = db.events.length;

    if (isEdit) {
        const ev = db.events.find(e => e.id === savedEditId);
        const newSnap = ev ? snapEvent(ev) : null;

        const changes = [];
        if (oldSnap && newSnap) {
            for (const key of Object.keys(FIELD_LABELS)) {
                if (String(oldSnap[key]) !== String(newSnap[key]))
                    changes.push(`${FIELD_LABELS[key]}: «${oldSnap[key]}» → «${newSnap[key]}»`);
            }
        }
        writeAudit({
            section: 'Реестр событий', action: 'Изменено',
            objectId: savedEditId,
            objectDesc: ev?.description || oldSnap?.description || '',
            details: changes.length ? changes.join(' | ') : 'Без изменений',
            beforeObj: oldSnap || undefined,
            afterObj:  newSnap || undefined,
        });
    } else if (newLen > prevLen) {
        const ev = db.events[db.events.length - 1];
        const snap = snapEvent(ev);
        writeAudit({
            section: 'Реестр событий', action: 'Создано',
            objectId: ev.id,
            objectDesc: ev.description,
            details: Object.entries(FIELD_LABELS)
                .map(([k, label]) => { const v = snap[k]; return (v && v !== '—' && v !== 'Нет' && v !== 'Не оценена' && v !== 'Не применимо') ? `${label}: ${v}` : null; })
                .filter(Boolean).join(' | '),
        });
    }
    saveDb();
};

const _origUpdateEventStatus = updateEventStatus;
updateEventStatus = function(selectEl) {
    const id = parseInt(selectEl.dataset.id);
    const ev = db.events.find(e => e.id === id);
    const before = ev?.status;
    _origUpdateEventStatus(selectEl);
    const after = selectEl.value;
    writeAudit({
        section: 'Реестр событий', action: 'Статус изменён',
        objectId: id,
        objectDesc: ev?.description || '',
        details: 'Изменение статуса события',
        before, after,
    });
    saveDb();
};

const _origConfirmDelete = confirmDelete;
confirmDelete = function() {
    if (eventIdToDelete !== null) {
        const ev = db.events.find(e => e.id === eventIdToDelete);
        writeAudit({
            section: 'Реестр событий', action: 'Удалено',
            objectId: eventIdToDelete,
            objectDesc: ev?.description || '',
            details: `Дата: ${ev?.date} | Таксономия: ${ev?.classification}`,
            before: ev ? `Рейтинг: ${ev.riskRating} | Статус: ${ev.status} | Отв.: ${ev.responsible || '—'} | Сущ.: ${ev.isSubstantial ? 'Да' : 'Нет'} | Вер.повт.: ${ev.recurrence || 'Не оценена'}` : '',
            after: '— УДАЛЕНО —',
        });
    }
    _origConfirmDelete();
    saveDb();
};

// ---- Предписания ----
const _origSaveOrder = saveOrder;
saveOrder = function() {
    // Фиксируем id ДО вызова — resetOrderForm() обнуляет editingOrderId внутри
    const savedOrderId = (typeof editingOrderId !== 'undefined') ? editingOrderId : null;
    const isEdit = !!savedOrderId;
    let oldSnap = null;
    if (isEdit) {
        const old = (db.orders || []).find(o => o.id === savedOrderId);
        if (old) oldSnap = {
            number: old.number,
            description: (old.description || '—').slice(0, 60),
            status: old.status,
            responsible: old.responsible || '—',
            deadline: old.deadline || '—',
            dateDone: old.dateDone || '—',
        };
    }
    const prevLen = (db.orders || []).length;
    _origSaveOrder();
    const newLen = (db.orders || []).length;
    if (isEdit) {
        const ord = (db.orders || []).find(o => o.id === savedOrderId);
        const newSnap = ord ? {
            number: ord.number,
            description: (ord.description || '—').slice(0, 60),
            status: ord.status,
            responsible: ord.responsible || '—',
            deadline: ord.deadline || '—',
            dateDone: ord.dateDone || '—',
        } : null;
        const LABELS = {
            number: '№', description: 'Суть', status: 'Статус',
            responsible: 'Ответственный', deadline: 'Дедлайн', dateDone: 'Дата исп.',
        };
        const changes = [];
        if (oldSnap && newSnap) {
            for (const key of Object.keys(LABELS)) {
                if (String(oldSnap[key]) !== String(newSnap[key]))
                    changes.push(`${LABELS[key]}: «${oldSnap[key]}» → «${newSnap[key]}»`);
            }
        }
        writeAudit({
            section: 'Предписания', action: 'Изменено',
            objectId: savedOrderId,
            objectDesc: `Вх. № ${ord?.number || '?'}`,
            details: changes.length ? changes.join(' | ') : 'Редактирование без изменений',
            before: oldSnap ? `Статус: ${oldSnap.status} | Ответственный: ${oldSnap.responsible} | Дедлайн: ${oldSnap.deadline}` : '',
            after: newSnap ? `Статус: ${newSnap.status} | Ответственный: ${newSnap.responsible} | Дедлайн: ${newSnap.deadline}` : '',
        });
    } else if (newLen > prevLen) {
        const ord = db.orders[db.orders.length - 1];
        writeAudit({
            section: 'Предписания', action: 'Создано',
            objectId: ord.id,
            objectDesc: `Вх. № ${ord.number}`,
            details: `Дедлайн: ${ord.deadline} | ${ord.description || ''}`,
        });
    }
    saveDb();
};

const _origDeleteOrder = deleteOrder;
deleteOrder = function(id) {
    const ord = (db.orders || []).find(o => o.id === id);
    if (ord) {
        writeAudit({
            section: 'Предписания', action: 'Удалено',
            objectId: id,
            objectDesc: `Вх. № ${ord.number}`,
            details: `Дедлайн: ${ord.deadline} | ${ord.description || ''}`,
            before: `Статус: ${ord.status} | Ответственный: ${ord.responsible || '—'} | Дедлайн: ${ord.deadline}`,
            after: 'Удалено',
        });
        saveDb();
    }
    _origDeleteOrder(id);
};

// ---- Жалобы ----
const _origSaveComplaint = saveComplaint;
saveComplaint = function() {
    const prevLen = (db.complaints || []).length;
    _origSaveComplaint();
    const newLen = (db.complaints || []).length;
    if (newLen > prevLen) {
        const c = db.complaints[db.complaints.length - 1];
        writeAudit({
            section: 'Жалобы', action: 'Создано',
            objectId: c.id,
            objectDesc: (c.description || '').slice(0, 80),
            details: `Канал: ${c.channel} | Дедлайн: ${c.deadline} | Статус: ${c.status}`,
        });
    }
    saveDb();
};

const _origDeleteComplaint = deleteComplaint;
deleteComplaint = function(id) {
    const c = (db.complaints || []).find(x => x.id === id);
    if (c) {
        writeAudit({
            section: 'Жалобы', action: 'Удалено',
            objectId: id,
            objectDesc: (c.description || '').slice(0, 80),
            details: `Канал: ${c.channel} | Дедлайн: ${c.deadline}`,
            before: `Статус: ${c.status} | Ответственный: ${c.responsible || '—'} | Риск: ${c.riskDetected}`,
            after: 'Удалено',
        });
        saveDb();
    }
    _origDeleteComplaint(id);
};

// ---- Проверки ----
// [audit check intercept moved to bottom]

const _origDeleteCheckRecord = deleteCheckRecord;
deleteCheckRecord = function(id) {
    const r = (db.checkRecords || []).find(x => x.id === id);
    if (r) {
        writeAudit({
            section: 'Проверки', action: 'Удалено',
            objectId: id,
            objectDesc: r.type,
            details: `Дата: ${r.date} | Объект: ${r.object}`,
            before: `Результат: ${r.result} | Объект: ${r.object}`,
            after: 'Удалено',
        });
        saveDb();
    }
    _origDeleteCheckRecord(id);
};

// ---- Фин. показатели ----
const _origSaveFinRecord = saveFinRecord;
saveFinRecord = function() {
    const prevLen = (db.financials?.records || []).length;
    _origSaveFinRecord();
    const newLen = (db.financials?.records || []).length;
    if (newLen > prevLen) {
        const r = db.financials.records[db.financials.records.length - 1];
        writeAudit({
            section: 'Фин. показатели', action: 'Создано',
            objectId: r.id,
            objectDesc: FIN_LABELS[r.type] || r.type,
            details: `Значение: ${r.value} ${FIN_UNITS[r.type] || ''} | Дата: ${r.date}`,
        });
    }
    saveDb();
};

const _origDeleteFinRecord = deleteFinRecord;
deleteFinRecord = function(id) {
    const r = (db.financials?.records || []).find(x => x.id === id);
    if (r) {
        writeAudit({
            section: 'Фин. показатели', action: 'Удалено',
            objectId: id,
            objectDesc: FIN_LABELS[r.type] || r.type,
            details: `Значение: ${r.value} | Дата: ${r.date}`,
        });
    }
    _origDeleteFinRecord(id);
    saveDb();
};

// ---- План проверок ----
const _origSavePlanItem = savePlanItem;
savePlanItem = function() {
    const prevLen = (db.planItems || []).length;
    _origSavePlanItem();
    const newLen = (db.planItems || []).length;
    if (newLen > prevLen) {
        const p = db.planItems[db.planItems.length - 1];
        writeAudit({
            section: 'План проверок', action: 'Создано',
            objectId: p.id,
            objectDesc: p.type,
            details: `Плановая дата: ${p.date} | Ответственный: ${p.responsible || '—'}`,
        });
    }
    saveDb();
};

const _origMarkPlanItemDone = markPlanItemDone;
markPlanItemDone = function(id) {
    const p = (db.planItems || []).find(x => x.id === id);
    const before = p?.status;
    _origMarkPlanItemDone(id);
    const after = (db.planItems || []).find(x => x.id === id)?.status;
    if (p) {
        writeAudit({
            section: 'План проверок', action: 'Статус изменён',
            objectId: id,
            objectDesc: p.type,
            details: `Плановая дата: ${p.date}`,
            before, after,
        });
    }
    saveDb();
};

const _origDeletePlanItem = deletePlanItem;
deletePlanItem = function(id) {
    const p = (db.planItems || []).find(x => x.id === id);
    if (p) {
        writeAudit({
            section: 'План проверок', action: 'Удалено',
            objectId: id,
            objectDesc: p.type,
            details: `Плановая дата: ${p.date}`,
        });
    }
    _origDeletePlanItem(id);
    saveDb();
};

// =============================================
// КОНФЛИКТ ИНТЕРЕСОВ
// =============================================
if (!db.conflicts) db.conflicts = [];

const _origSaveCheckRecord_audit = saveCheckRecord;
saveCheckRecord = function() {
    const editingId = document.getElementById('chk-editing-id')?.value;
    const isEdit = !!editingId;
    let oldSnap = null;
    if (isEdit) {
        const old = (db.checkRecords||[]).find(x => x.id === parseInt(editingId));
        if (old) oldSnap = { result: old.result, fixStatus: old.fixStatus };
    }
    const prevLen = (db.checkRecords||[]).length;
    _origSaveCheckRecord_audit();
    const newLen = (db.checkRecords||[]).length;
    if (isEdit) {
        const r = (db.checkRecords||[]).find(x => x.id === parseInt(editingId));
        writeAudit({
            section: 'Проверки', action: 'Изменено',
            objectId: parseInt(editingId),
            objectDesc: r?.type || '',
            details: `Объект: ${r?.object||'—'} | Результат: ${r?.result||'—'} | Устранение: ${r?.fixStatus||'—'}`,
            before: oldSnap ? `Результат: ${oldSnap.result} | Устранение: ${oldSnap.fixStatus||'—'}` : '',
            after:  r       ? `Результат: ${r.result} | Устранение: ${r.fixStatus||'—'}`             : '',
        });
    } else if (newLen > prevLen) {
        const r = db.checkRecords[db.checkRecords.length - 1];
        writeAudit({
            section: 'Проверки', action: 'Создано',
            objectId: r.id,
            objectDesc: r.type,
            details: `Объект: ${r.object} | Результат: ${r.result} | Проверяющий: ${r.inspector||'—'} | Устранение: ${r.fixStatus||'—'}`,
        });
    }
    saveDb();
};

// ---- Логи — иконка для конфликтов ----
document.addEventListener('DOMContentLoaded', () => {
    // Патч иконок раздела в логах — добавляем 'Конфликт интересов'
    const _origRenderAuditLog = renderAuditLog;
    renderAuditLog = function() {
        _origRenderAuditLog();
        // иконки уже прописаны внутри renderAuditLog через sectionIcons
    };
});

// ---- Интеграция в навигацию ----
document.addEventListener('DOMContentLoaded', () => {
    initAuditLog();
    if (!db.conflicts) { db.conflicts = []; saveDb(); }
    document.querySelectorAll('.nav-link[data-target="section-auditlog"]').forEach(link => {
        link.addEventListener('click', () => {
            auditPage = 0;
            setTimeout(renderAuditLog, 50);
        });
    });
    document.querySelectorAll('.nav-link[data-target="section-conflicts"]').forEach(link => {
        link.addEventListener('click', () => setTimeout(renderConflicts, 50));
    });
    document.querySelectorAll('.nav-link[data-target="section-checks"]').forEach(link => {
        link.addEventListener('click', () => {
            switchChecksTab('log');
            setTimeout(renderCheckRecords, 50);
        });
    });
});
