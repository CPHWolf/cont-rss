// ============================================================
// МОДУЛЬ 05: НАВИГАЦИЯ, ПОИСК И UI
// ============================================================
// setupListeners()        — навигация по разделам (главная)
// toggleDark()            — темная/светлая тема
// showSearchPanel/handleGlobalSearch/runSearch/searchGoTo — поиск
// toggleRegistriesMenu()  — мобильное меню реестров
// checkUnsavedChanges()   — флаг несохранённых изменений
// navigateToSection()     — программный переход к разделу
// renderAlertBanners()    — баннеры-предупреждения
// ============================================================

 function setupListeners() {
    const navLinks = document.querySelectorAll('.nav-link[data-target]');
    const sections = document.querySelectorAll('.content-section');

    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const targetId = link.getAttribute('data-target');
            if (!targetId) return;

            document.querySelectorAll('.nav-link').forEach(nl => nl.classList.remove('active'));
            
            const parentButton = link.closest('#nav-registries-group')?.querySelector('button');
            if (parentButton) {
                parentButton.classList.add('active');
                // Закрыть dropdown
                document.getElementById('registries-dropdown')?.classList.add('hidden');
                const arrow = document.getElementById('registries-arrow');
                if (arrow) arrow.textContent = '▼';
            } else {
                link.classList.add('active');
            }

            sections.forEach(section => section.classList.remove('active'));
            const activeSection = document.getElementById(targetId);
            if (activeSection) activeSection.classList.add('active');
            
            if (targetId === 'section-main') {
                updateMetrics();
                updateGanttChart();
                updateReportCharts();
            } else if (targetId === 'section-register') {
                filterAndRenderRegister();
            } else if (targetId === 'section-orders') {
                renderOrders();
            } else if (targetId === 'section-checks') {
                renderCheckRecords();
            } else if (targetId === 'section-complaints') {
                renderComplaints();
            } else if (targetId === 'section-knowledge') {
                renderExternalLinks();
                if (typeof renderKnowledgeItems === 'function') renderKnowledgeItems();
            }
        });
    });
}
function toggleDark() {
    const isDark = document.documentElement.classList.toggle('dark');
    localStorage.setItem('darkMode', isDark ? '1' : '0');
    document.getElementById('dark-icon').textContent = isDark ? '☀️' : '🌙';
    document.getElementById('dark-label').textContent = isDark ? 'Светлая' : 'Тёмная';
    // Перерисовать легенды финансовых графиков с новым цветом текста
    const col = isDark ? '#E0D9D4' : '#4B4240';
    [
        window.financialsNkdChart,
        window.financialsNklChart,
        window.financialsEquityChart
    ].forEach(ch => {
        if (!ch) return;
        if (ch.options?.plugins?.legend?.labels)
            ch.options.plugins.legend.labels.color = col;
        ch.update('none'); // без анимации
    });
}
(function() {
    if (localStorage.getItem('darkMode') === '1') {
        document.documentElement.classList.add('dark');
        document.addEventListener('DOMContentLoaded', () => {
            const icon = document.getElementById('dark-icon');
            const label = document.getElementById('dark-label');
            if (icon) icon.textContent = '☀️';
            if (label) label.textContent = 'Светлая';
        });
    }
})();

// =============================================
// ГЛОБАЛЬНЫЙ ПОИСК
// =============================================
let _searchTimeout = null;

function showSearchPanel() {
    const q = document.getElementById('global-search').value.trim();
    if (q.length >= 2) {
        document.getElementById('search-results-panel').style.display = 'block';
        runSearch(q);
    }
}

function handleGlobalSearch(val) {
    clearTimeout(_searchTimeout);
    const panel = document.getElementById('search-results-panel');
    if (val.trim().length < 2) { panel.style.display = 'none'; return; }
    _searchTimeout = setTimeout(() => {
        panel.style.display = 'block';
        runSearch(val.trim());
    }, 180);
}

function runSearch(q) {
    const panel = document.getElementById('search-results-panel');
    const ql = q.toLowerCase();
    let html = '';
    let totalCount = 0;

    function hl(text) {
        if (!text) return '';
        const re = new RegExp(`(${q.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')})`, 'gi');
        return String(text).replace(re, '<mark class="search-highlight">$1</mark>');
    }

    const evHits = (db.events || []).filter(e =>
        [e.description, e.classification, e.source, e.measures, e.responsible]
            .some(f => f && String(f).toLowerCase().includes(ql))
    );
    if (evHits.length) {
        html += `<div class="search-result-section">📋 Реестр событий (${evHits.length})</div>`;
        evHits.slice(0, 6).forEach(e => {
            const sc = e.status==='Выявлено'?'text-red-700':e.status==='Устранено'?'text-green-700':'text-yellow-700';
            html += `<div class="search-result-item" onclick="searchGoTo('register',${e.id})">
                <div class="search-result-title">#${e.id} — ${hl(e.description)}</div>
                <div class="search-result-sub">${hl(e.classification)} &nbsp;|&nbsp; <span class="${sc}">${e.status}</span> &nbsp;|&nbsp; ${e.date}</div>
            </div>`;
            totalCount++;
        });
    }

    const ordHits = (db.orders || []).filter(o =>
        [o.number, o.description, o.responsible, o.status]
            .some(f => f && String(f).toLowerCase().includes(ql))
    );
    if (ordHits.length) {
        html += `<div class="search-result-section">📄 Предписания (${ordHits.length})</div>`;
        ordHits.slice(0, 4).forEach(o => {
            html += `<div class="search-result-item" onclick="searchGoTo('orders',${o.id})">
                <div class="search-result-title">Вх. № ${hl(o.number)} — ${hl((o.description||'').substring(0,60))}</div>
                <div class="search-result-sub">${o.status} &nbsp;|&nbsp; Дедлайн: ${o.deadline}</div>
            </div>`;
            totalCount++;
        });
    }

    const chkHits = (db.checkRecords || []).filter(c =>
        [c.type, c.object, c.result].some(f => f && String(f).toLowerCase().includes(ql))
    );
    if (chkHits.length) {
        html += `<div class="search-result-section">🔍 Проверки (${chkHits.length})</div>`;
        chkHits.slice(0, 4).forEach(c => {
            const cls = c.result==='Выявлены нарушения'?'text-red-700':'text-green-700';
            html += `<div class="search-result-item" onclick="searchGoTo('checks',${c.id})">
                <div class="search-result-title">${hl(c.type)}</div>
                <div class="search-result-sub">${c.date} &nbsp;|&nbsp; ${hl(c.object)} &nbsp;|&nbsp; <span class="${cls}">${c.result}</span></div>
            </div>`;
            totalCount++;
        });
    }

    const cmpHits = (db.complaints || []).filter(c =>
        [c.description, c.channel, c.responsible, c.result]
            .some(f => f && String(f).toLowerCase().includes(ql))
    );
    if (cmpHits.length) {
        html += `<div class="search-result-section">💬 Обращения (${cmpHits.length})</div>`;
        cmpHits.slice(0, 4).forEach(c => {
            html += `<div class="search-result-item" onclick="searchGoTo('complaints',${c.id})">
                <div class="search-result-title">${hl((c.description||'').substring(0,70))}</div>
                <div class="search-result-sub">${c.date} &nbsp;|&nbsp; ${c.channel} &nbsp;|&nbsp; ${c.status}</div>
            </div>`;
            totalCount++;
        });
    }

    if (totalCount === 0) {
        html = `<div id="search-empty">Ничего не найдено по запросу «${q}»</div>`;
    }

    // ---- База знаний — внешние ссылки ----
    const linkHits = (db.externalLinks || []).filter(l =>
        [l.title, l.url, l.description].some(f => f && String(f).toLowerCase().includes(ql))
    );
    if (linkHits.length) {
        html += `<div class="search-result-section">📚 База знаний — ссылки (${linkHits.length})</div>`;
        linkHits.slice(0, 5).forEach(l => {
            html += `<div class="search-result-item" onclick="searchGoTo('knowledge', ${l.id})">
                <div class="search-result-title">🔗 ${hl(l.title)}</div>
                <div class="search-result-sub" style="color:#6b7280">${hl(l.url)}</div>
            </div>`;
            totalCount++;
        });
    }

    // ---- База знаний — справочник терминов ----
    const infoItems = db.knowledgeItems || [];
    const infoHits = infoItems.filter(item =>
        [item.title, item.body].some(f => f && String(f).toLowerCase().includes(ql))
    );
    if (infoHits.length) {
        html += `<div class="search-result-section">📖 База знаний — термины (${infoHits.length})</div>`;
        infoHits.slice(0, 4).forEach(item => {
            const snippet = item.body && item.body.length > 80 ? item.body.slice(0, 80) + '…' : (item.body || '');
            html += `<div class="search-result-item" onclick="searchGoTo('knowledge-info', ${item.id})">
                <div class="search-result-title">📖 ${hl(item.title)}</div>
                <div class="search-result-sub" style="color:#6b7280">${hl(snippet)}</div>
            </div>`;
            totalCount++;
        });
    }

        // ---- Конфликт интересов ----
    const coiHits = (db.conflicts || []).filter(c =>
        [c.description, c.type, c.parties, c.responsible, c.result, c.resolutionType]
            .some(f => f && String(f).toLowerCase().includes(ql))
    );
    if (coiHits.length) {
        html += `<div class="search-result-section">Конфликт интересов (${coiHits.length})</div>`;
        coiHits.slice(0, 4).forEach(c => {
            const riskCls = c.risk === 'Высокий' ? 'color:red' : c.risk === 'Средний' ? 'color:orange' : 'color:green';
            html += `<div class="search-result-item" onclick="searchGoTo('conflicts',${c.id},'coi')">
                <div class="search-result-title">${hl(c.type)} — ${hl((c.description||'').slice(0,60))}</div>
                <div class="search-result-sub">${c.date} &nbsp;|&nbsp; <span style="${riskCls}">${c.risk}</span> &nbsp;|&nbsp; ${c.status}</div>
            </div>`;
            totalCount++;
        });
    }

    if (totalCount === 0) {
        html = `<div id="search-empty">Ничего не найдено по запросу «${q}»</div>`;
    }
    panel.innerHTML = html;
}

function searchGoTo(section, itemId, itemType) {
    // Сохранить поисковый запрос ДО очистки инпута (нужен для подсветки)
    const lastQuery = document.getElementById('global-search')?.value?.trim() || '';
    document.getElementById('global-search').value = '';
    document.getElementById('search-results-panel').style.display = 'none';
    const sectionMap = {
        register:       'section-register',
        orders:         'section-orders',
        checks:         'section-checks',
        complaints:     'section-complaints',
        knowledge:      'section-knowledge',
        'knowledge-info': 'section-knowledge',
        financials:     'section-financials',
        auditlog:       'section-auditlog',
        conflicts:      'section-conflicts',
    };
    const target = sectionMap[section];
    if (!target) return;

    function flash(el, color) {
        if (!el) return;
        const orig = el.style.background;
        el.style.transition = 'background 0.4s';
        el.style.background = color || '#FFF9C4';
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        setTimeout(() => { el.style.background = orig || ''; }, 2500);
    }

    function highlightRow(tbodyId, id) {
        const row = document.querySelector(`#${tbodyId} tr[data-row-id="${id}"]`);
        flash(row);
    }

    const link = document.querySelector(`.nav-link[data-target="${target}"]`);
    if (link) link.click();

    if (!itemId) return;

    setTimeout(() => {
        // Реестр событий
        if (section === 'register') {
            filterAndRenderRegister();
            setTimeout(() => {
                document.querySelectorAll('#risk-register-table tr').forEach(row => {
                    const btn = row.querySelector('button[onclick*="editEvent"]');
                    if (btn && btn.getAttribute('onclick').includes(`(${itemId})`)) flash(row);
                });
            }, 150);
            return;
        }

        // Предписания
        if (section === 'orders') {
            highlightRow('orders-table-body', itemId);
            return;
        }

        // Жалобы
        if (section === 'complaints') {
            highlightRow('complaints-table-body', itemId);
            return;
        }

        // Проверки — журнал или план
        if (section === 'checks') {
            if (itemType === 'plan') {
                if (typeof switchChecksTab === 'function') switchChecksTab('plan');
                setTimeout(() => {
                    const btns = document.querySelectorAll('#plan-calendar-grid button');
                    btns.forEach(btn => {
                        if (btn.getAttribute('onclick')?.includes(`(${itemId})`)) {
                            const cell = btn.closest('div') || btn;
                            flash(cell, '#e0f2fe');
                        }
                    });
                }, 300);
            } else {
                if (typeof switchChecksTab === 'function') switchChecksTab('log');
                setTimeout(() => highlightRow('checks-table-body', itemId), 200);
            }
            return;
        }

        // Конфликт интересов
        if (section === 'conflicts') {
            setTimeout(() => highlightRow('conflicts-table-body', itemId), 200);
            return;
        }

        // База знаний — ссылки
        if (section === 'knowledge') {
            const el = document.getElementById(`ext-link-${itemId}`) ||
                       document.querySelector(`#external-links-list li[data-link-id="${itemId}"]`);
            if (el) {
                el.style.transition = 'background 0.4s, box-shadow 0.4s';
                el.style.background = '#fef9c3';
                el.style.borderRadius = '6px';
                el.style.boxShadow = '0 0 0 2px #D9A86E';
                el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                setTimeout(() => { el.style.background = ''; el.style.boxShadow = ''; }, 2500);
            }
            return;
        }

        // База знаний — термины справочника
        if (section === 'knowledge-info') {
            if (typeof renderKnowledgeItems === 'function') renderKnowledgeItems();
            setTimeout(() => {
                const el = document.querySelector(`[data-info-id="${itemId}"]`);
                if (!el) return;
                if (lastQuery) {
                    const pEl = el.querySelector('p, .knowledge-item-body');
                    if (pEl) {
                        const orig = pEl.textContent;
                        const re = new RegExp(`(${lastQuery.replace(/[.*+?^${}()|[\]\\]/g, '\$&')})`, 'gi');
                        pEl.innerHTML = orig.replace(re, '<mark class="search-highlight">$1</mark>');
                        setTimeout(() => { pEl.innerHTML = orig; }, 4000);
                    }
                }
                el.style.transition = 'box-shadow 0.3s, background 0.3s';
                el.style.background = '#fef9c3';
                el.style.boxShadow = '0 0 0 2px #D9A86E';
                el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                setTimeout(() => { el.style.background = ''; el.style.boxShadow = ''; }, 3000);
            }, 400);
            return;
        }

        // Фин. показатели
        if (section === 'financials') {
            const filterEl = document.getElementById('fin-filter-type');
            if (filterEl && filterEl.value) { filterEl.value = ''; renderFinTable(); }
            setTimeout(() => {
                const el = document.getElementById(`fin-record-${itemId}`) ||
                           document.querySelector(`#fin-table-body tr[data-row-id="${itemId}"]`);
                flash(el);
            }, 150);
            return;
        }

        // Логи — с пагинацией
        if (section === 'auditlog') {
            auditPage = 0;
            setTimeout(() => {
                renderAuditLog();
                setTimeout(() => {
                    const row = document.querySelector(`#audit-table-body tr[data-row-id="${itemId}"]`);
                    if (row) { flash(row, '#f0fdf4'); return; }
                    const idx = (db.auditLog || []).findIndex(e => e.id === itemId);
                    if (idx >= 0) {
                        auditPage = Math.floor(idx / AUDIT_PAGE_SIZE);
                        renderAuditLog();
                        setTimeout(() => flash(document.querySelector(`#audit-table-body tr[data-row-id="${itemId}"]`), '#f0fdf4'), 100);
                    }
                }, 150);
            }, 300);
            return;
        }
    }, 300);
}

document.addEventListener('click', e => {
    const wrap = document.getElementById('global-search-wrap');
    if (wrap && !wrap.contains(e.target))
        document.getElementById('search-results-panel').style.display = 'none';
});
document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
        document.getElementById('search-results-panel').style.display = 'none';
        document.getElementById('global-search').blur();
    }
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        document.getElementById('global-search').focus();
    }
});

// =============================================
// МОБИЛЬНЫЙ DROPDOWN
// =============================================
function toggleRegistriesMenu(e) {
    e.stopPropagation();
    const dropdown = document.getElementById('registries-dropdown');
    const arrow = document.getElementById('registries-arrow');
    const isHidden = dropdown.classList.contains('hidden');
    dropdown.classList.toggle('hidden', !isHidden);
    if (arrow) arrow.textContent = isHidden ? '▲' : '▼';
}
// Закрыть при клике вне
document.addEventListener('click', function(e) {
    const group = document.getElementById('nav-registries-group');
    const dropdown = document.getElementById('registries-dropdown');
    const arrow = document.getElementById('registries-arrow');
    if (group && !group.contains(e.target)) {
        dropdown.classList.add('hidden');
        if (arrow) arrow.textContent = '▼';
    }
});

// =============================================
// ПРЕДУПРЕЖДЕНИЕ ПРИ ЗАКРЫТИИ (НЕСОХРАНЁННЫЕ ДАННЫЕ)
// =============================================

// =============================================
// ПЕЧАТЬ ОТЧЁТА
// =============================================
function navigateToSection(targetId, itemType, ids) {
    ids = ids || [];
    const lnk = document.querySelector('.nav-link[data-target="' + targetId + '"]');
    if (lnk) {
        lnk.click();
    } else {
        document.querySelectorAll('.content-section').forEach(s => s.classList.remove('active'));
        const sec = document.getElementById(targetId);
        if (sec) sec.classList.add('active');
    }

    if (!itemType || !ids.length) return;

    // Ждём рендера таблицы, затем подсвечиваем
    setTimeout(() => {
        const PULSE = 'alert-row-highlight';
        let tableSelector = '';
        if (itemType === 'events')     tableSelector = '#risk-register-table tr';
        if (itemType === 'orders')     tableSelector = '#orders-table-body tr';
        if (itemType === 'complaints') tableSelector = '#complaints-table-body tr';
        if (!tableSelector) return;

        const rows = document.querySelectorAll(tableSelector);
        let firstRow = null;

        rows.forEach(row => {
            // Определяем id строки по data-атрибуту или по кнопке редактирования
            let rowId = null;
            const idAttr = row.getAttribute('data-row-id');
            if (idAttr) {
                rowId = parseInt(idAttr);
            } else {
                // Fallback: ищем кнопку edit/delete с id в onclick
                const btn = row.querySelector('button[onclick*="edit"], button[onclick*="delete"], select[data-id]');
                if (btn) {
                    const m = (btn.getAttribute('onclick') || btn.getAttribute('data-id') || '').match(/\d+/);
                    if (m) rowId = parseInt(m[0]);
                }
            }
            if (rowId !== null && ids.includes(rowId)) {
                row.classList.add(PULSE);
                row.style.transition = 'background 0.4s';
                row.style.outline = '2px solid #f59e0b';
                row.style.outlineOffset = '-2px';
                if (!firstRow) firstRow = row;
                // Снимаем подсветку через 4 сек
                setTimeout(() => {
                    row.classList.remove(PULSE);
                    row.style.outline = '';
                    row.style.outlineOffset = '';
                    row.style.background = '';
                }, 4000);
            }
        });

        if (firstRow) {
            firstRow.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    }, 350);
}

function renderAlertBanners() {
    const container = document.getElementById('alert-banners');
    if (!container) return;
    const today = new Date().toISOString().split('T')[0];
    const alerts = [];

    // Просроченные события реестра
    const overdueEvents = (db.events || []).filter(e => e.deadline && e.deadline < today && e.status !== 'Устранено');
    if (overdueEvents.length > 0) {
        alerts.push({
            color: 'bg-red-600', icon: '⛔',
            text: `${overdueEvents.length} ${overdueEvents.length === 1 ? 'событие просрочено' : 'событий просрочено'} в реестре`,
            target: 'section-register', itemType: 'events', ids: overdueEvents.map(e => e.id)
        });
    }

    // События без ответственного
    const noOwner = (db.events || []).filter(e => e.status === 'Выявлено' && !e.responsible);
    if (noOwner.length > 0) {
        alerts.push({
            color: 'bg-yellow-600', icon: '⚠️',
            text: `${noOwner.length} ${noOwner.length === 1 ? 'событие без ответственного' : 'событий без ответственного'}`,
            target: 'section-register', itemType: 'events', ids: noOwner.map(e => e.id)
        });
    }

    // Просроченные предписания
    const overdueOrders = (db.orders || []).filter(o => o.deadline && o.deadline < today && o.status !== 'Исполнено' && !o.parentId && !(db.orders || []).some(c => c.parentId === o.id));
    if (overdueOrders.length > 0) {
        alerts.push({
            color: 'bg-red-800', icon: '📋',
            text: `${overdueOrders.length} предписани${overdueOrders.length === 1 ? 'е просрочено' : 'й просрочено'} (ЦБ/СРО)`,
            target: 'section-orders', itemType: 'orders', ids: overdueOrders.map(o => o.id)
        });
    }

    // Нарушение финансовых нормативов
    const finRecords = db.financials?.records || [];
    const mins = db.financials?.mins || {};
    ['nkd', 'nkl', 'equity'].forEach(type => {
        const typeRecs = finRecords.filter(r => r.type === type).sort((a,b) => new Date(b.date) - new Date(a.date));
        if (typeRecs.length > 0) {
            const latest = typeRecs[0];
            const min = mins[type] ?? 0;
            if (latest.value < min) {
                alerts.push({
                    color: 'bg-red-700', icon: '📉',
                    text: `${FIN_LABELS[type] || type} ниже минимума! Факт: ${latest.value.toLocaleString('ru-RU')} — Минимум: ${min.toLocaleString('ru-RU')}`,
                    target: 'section-financials', itemType: null, ids: []
                });
            }
        }
    });

    // Просроченные жалобы
    const overdueComplaints = (db.complaints || []).filter(c => c.deadline && c.deadline < today && c.status !== 'Рассмотрено');
    if (overdueComplaints.length > 0) {
        alerts.push({
            color: 'bg-orange-600', icon: '📩',
            text: `${overdueComplaints.length} обращени${overdueComplaints.length === 1 ? 'е просрочено' : 'й просрочено'} без рассмотрения`,
            target: 'section-complaints', itemType: 'complaints', ids: overdueComplaints.map(c => c.id)
        });
    }

    if (alerts.length === 0) {
        container.innerHTML = '<div class="flex items-center gap-2 text-green-700 bg-green-50 border border-green-200 rounded-lg px-4 py-3 text-sm font-semibold">✅ Нарушений и просрочек не обнаружено</div>';
        return;
    }

    // Сериализуем ids в data-атрибут, избегая проблем с кавычками в onclick
    window._alertItems = alerts;
    container.innerHTML = alerts.map((a, idx) => `
        <div class="flex items-center justify-between ${a.color} text-white rounded-lg px-4 py-3 cursor-pointer hover:opacity-90 transition"
             onclick="(function(){var a=window._alertItems[${idx}];navigateToSection(a.target,a.itemType,a.ids);})()">
            <span class="font-semibold text-sm">${a.icon} ${a.text}</span>
            <span class="text-xs opacity-75">Нажмите → перейти</span>
        </div>
    `).join('');
}

// Поле вероятности повторения — добавляется напрямую через патч resetForm
const _origResetForm = resetForm;
resetForm = function() {
    _origResetForm();
    const el = document.getElementById('reg-recurrence');
    if (el) el.value = 'Не оценена';
};

// =============================================
// ГОДОВОЙ ПЛАН ПРОВЕРОК
// =============================================
