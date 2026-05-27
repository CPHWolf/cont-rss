/* ============================================================
   17-enhancements.js — Bloomberg Terminal Enhancements v3
   ============================================================ */

(function () {
    'use strict';

    function getDb() { try { return db; } catch(e) { return null; } }

    /* ============================================================
       1. COUNTER ANIMATION
    ============================================================ */
    function animateCounter(el, duration) {
        const raw = el.textContent.trim();
        const num = parseFloat(raw.replace(/[^\d.-]/g, ''));
        if (isNaN(num) || num === 0) return;
        const suffix = raw.replace(/^[\d.-]+/, '');
        const isFloat = raw.includes('.');
        const start = performance.now();
        function tick(now) {
            const p = Math.min((now - start) / duration, 1);
            const eased = 1 - Math.pow(1 - p, 3);
            el.textContent = (isFloat ? (num*eased).toFixed(2) : Math.round(num*eased)) + suffix;
            if (p < 1) requestAnimationFrame(tick);
            else el.textContent = raw;
        }
        requestAnimationFrame(tick);
    }

    const COUNTER_IDS = [
        'metric-total-events','metric-substantial-events','metric-inprogress-events','metric-resolved-events',
        'chk-stat-total','chk-stat-ok','chk-stat-violations','chk-stat-open',
        'coi-stat-total','coi-stat-open','coi-stat-resolved','coi-stat-high',
        'audit-stat-total','audit-stat-today','audit-stat-creates','audit-stat-edits',
        'cmp-count-total','cmp-count-active','cmp-count-overdue',
    ];

    function runCounters() {
        COUNTER_IDS.forEach(id => {
            const el = document.getElementById(id);
            if (el && el.textContent.trim() !== '0') animateCounter(el, 750);
        });
    }

    /* ============================================================
       2. STATUS BAR
    ============================================================ */
    function createStatusBar() {
        if (document.getElementById('bb-statusbar')) return;
        const bar = document.createElement('div');
        bar.id = 'bb-statusbar';
        bar.innerHTML = `
            <div class="bb-sb-left">
                <span class="bb-sb-section" id="bb-sec">СВОДКА ПО РИСКАМ</span>
                <span class="bb-sb-div">│</span>
                <span class="bb-sb-info" id="bb-records">—</span>
                <span class="bb-sb-div">│</span>
                <span class="bb-sb-info" id="bb-last-action">Система готова</span>
            </div>
            <div class="bb-sb-right">
                <span class="bb-sb-warn" id="bb-overdue-warn" style="display:none"></span>
                <span class="bb-sb-hint">F1 Сводка · F2 Реестр · F3 Предписания · F4 Финансы · F5 База знаний · F6 Логи</span>
                <span class="bb-sb-div">│</span>
                <span class="bb-sb-time" id="bb-sb-clock"></span>
            </div>`;
        document.body.appendChild(bar);
        document.body.style.paddingBottom = '32px';
        tickClock();
        setInterval(tickClock, 1000);
    }

    function tickClock() {
        const el = document.getElementById('bb-sb-clock');
        if (el) el.textContent = new Date().toLocaleTimeString('ru-RU', {hour:'2-digit',minute:'2-digit',second:'2-digit'});
    }

    function updateStatusBar(sectionId) {
        const NAMES = {
            'section-main':'СВОДКА ПО РИСКАМ','section-register':'РЕЕСТР СОБЫТИЙ',
            'section-orders':'ПРЕДПИСАНИЯ И ЗАПРОСЫ','section-checks':'ЖУРНАЛ ПРОВЕРОК',
            'section-complaints':'ОБРАЩЕНИЯ И ЖАЛОБЫ','section-conflicts':'КОНФЛИКТЫ ИНТЕРЕСОВ',
            'section-financials':'ФИНАНСОВЫЕ ПОКАЗАТЕЛИ','section-knowledge':'БАЗА ЗНАНИЙ',
            'section-auditlog':'ЛОГ ИЗМЕНЕНИЙ','section-forecast-detail':'РАСЧЁТ ПРОГНОЗА',
        };
        const sec = document.getElementById('bb-sec');
        if (sec) sec.textContent = NAMES[sectionId] || sectionId.toUpperCase();
    }

    /* ============================================================
       3. F-KEY HOTKEYS
    ============================================================ */
    const FK = { F1:'section-main',F2:'section-register',F3:'section-orders',F4:'section-financials',F5:'section-knowledge',F6:'section-auditlog' };

    let toastTimer;
    function showToast(key, sectionId) {
        const NAMES = { 'section-main':'СВОДКА','section-register':'РЕЕСТР СОБЫТИЙ','section-orders':'ПРЕДПИСАНИЯ','section-financials':'ФИН. ПОКАЗАТЕЛИ','section-knowledge':'БАЗА ЗНАНИЙ','section-auditlog':'ЛОГИ' };
        let toast = document.getElementById('bb-toast');
        if (!toast) { toast = document.createElement('div'); toast.id = 'bb-toast'; document.body.appendChild(toast); }
        toast.textContent = `${key}  →  ${NAMES[sectionId] || sectionId}`;
        toast.classList.add('bb-toast--visible');
        clearTimeout(toastTimer);
        toastTimer = setTimeout(() => toast.classList.remove('bb-toast--visible'), 1600);
    }

    function setupHotkeys() {
        document.addEventListener('keydown', function(e) {
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
            const target = FK[e.key];
            if (target) { e.preventDefault(); const link = document.querySelector(`[data-target="${target}"]`); if (link) link.click(); showToast(e.key, target); }
            if (e.key === 'Escape') {
                closeDetailOverlay();
                const panel = document.getElementById('search-results-panel');
                if (panel) panel.style.display = 'none';
            }
        });
    }

    /* ============================================================
       4. NAV F-KEY HINTS
    ============================================================ */
    function addNavHints() {
        document.querySelectorAll('#navigation > li').forEach(li => {
            const link = li.querySelector('[data-target]') || li.querySelector('#registries-btn');
            if (!link || link.classList.contains('nav-link-disabled')) return;
            const target = link.getAttribute('data-target');
            const fk = Object.entries(FK).find(([k,v]) => v === target);
            if (fk) {
                const hint = document.createElement('span');
                hint.className = 'bb-nav-fk';
                hint.textContent = fk[0];
                link.appendChild(hint);
            }
        });
    }

    /* ============================================================
       5. OVERDUE BADGE
    ============================================================ */
    function updateOverdueBadge() {
        try {
            const db = getDb();
            if (!db) return;
            const today = new Date().toISOString().slice(0,10);
            let n = 0;
            if (db.events) n += db.events.filter(e => e.deadline && e.deadline < today && e.status !== 'Устранено').length;
            if (db.orders) n += db.orders.filter(o => o.deadline && o.deadline < today && !['Исполнено','Отправлено'].includes(o.status)).length;
            if (db.complaints) n += db.complaints.filter(c => c.deadline && c.deadline < today && c.status !== 'Рассмотрено').length;
            let badge = document.getElementById('bb-nav-badge');
            const btn = document.getElementById('registries-btn');
            if (btn && n > 0) {
                if (!badge) { badge = document.createElement('span'); badge.id = 'bb-nav-badge'; badge.className = 'bb-nav-badge'; btn.appendChild(badge); }
                badge.textContent = n;
            } else if (badge) badge.remove();
            const warn = document.getElementById('bb-overdue-warn');
            if (warn) { warn.textContent = n > 0 ? `⚠ ПРОСРОЧЕНО: ${n}` : ''; warn.style.display = n > 0 ? '' : 'none'; }
        } catch(e) {}
    }

    /* ============================================================
       6. STATUS DOTS
    ============================================================ */
    const DOT_MAP = {
        'Выявлено':{color:'var(--red)',pulse:true},'В работе':{color:'var(--yellow)',pulse:true},
        'Устранено':{color:'var(--green)',pulse:false},'Просрочено':{color:'var(--red)',pulse:true},
        'В рассмотрении':{color:'var(--yellow)',pulse:true},'Рассмотрено':{color:'var(--green)',pulse:false},
        'Исполнено':{color:'var(--green)',pulse:false},'Выявлен':{color:'var(--red)',pulse:true},
        'Урегулирован':{color:'var(--green)',pulse:false},'В урегулировании':{color:'var(--yellow)',pulse:true},
        'Отправлено':{color:'var(--blue)',pulse:false},'На согласовании':{color:'var(--yellow)',pulse:true},
        'Раскрыт клиенту':{color:'var(--blue)',pulse:false},
    };

    function addStatusDots() {
        document.querySelectorAll('tbody td').forEach(td => {
            if (td.dataset.bbDot) return;
            const text = td.textContent.trim();
            const cfg = DOT_MAP[text];
            if (!cfg) return;
            td.dataset.bbDot = '1';
            const dot = document.createElement('span');
            dot.className = 'bb-dot' + (cfg.pulse ? ' bb-dot--pulse' : '');
            dot.style.background = cfg.color;
            td.insertBefore(dot, td.firstChild);
        });
    }

    /* ============================================================
       7. RISK BARS
    ============================================================ */
    const RISK_COLORS = ['','#00C853','#8BC34A','#FFB800','#FF6600','#FF3B30'];
    function renderRiskBars() {
        document.querySelectorAll('#risk-register-table td').forEach(td => {
            if (td.dataset.bbRisk) return;
            const m = td.textContent.trim().match(/^([1-5])\s*[-–]/);
            if (!m) return;
            td.dataset.bbRisk = '1';
            const r = parseInt(m[1]);
            const bar = document.createElement('div');
            bar.className = 'bb-risk-bar';
            bar.style.cssText = `background:linear-gradient(to right,${RISK_COLORS[r]} ${r*20}%,var(--border) ${r*20}%)`;
            td.appendChild(bar);
        });
    }

    /* ============================================================
       8. BUTTON RIPPLE
    ============================================================ */
    function setupRipple() {
        document.addEventListener('mousedown', function(e) {
            const btn = e.target.closest('button');
            if (!btn) return;
            const r = document.createElement('span');
            r.className = 'bb-ripple';
            const rect = btn.getBoundingClientRect();
            const sz = Math.max(rect.width, rect.height) * 1.5;
            r.style.cssText = `width:${sz}px;height:${sz}px;left:${e.clientX-rect.left-sz/2}px;top:${e.clientY-rect.top-sz/2}px`;
            btn.style.position = 'relative';
            btn.style.overflow = 'hidden';
            btn.appendChild(r);
            setTimeout(() => r.remove(), 600);
        });
    }

    /* ============================================================
       9. FULL-SCREEN DETAIL OVERLAY
    ============================================================ */

    // --- SVG helpers ---
    function riskGaugeSVG(rating) {
        const colors = ['','#00C853','#8BC34A','#FFB800','#FF6600','#FF3B30'];
        const labels = ['','Низкий','Умеренный','Средний','Высокий','Критический'];
        const color = colors[rating] || '#666';
        const pct = (rating / 5) * 100;
        const circumference = 2 * Math.PI * 40;
        const dash = (pct / 100) * circumference;
        return `<svg viewBox="0 0 100 60" class="bb-gauge-svg">
            <circle cx="50" cy="50" r="40" fill="none" stroke="var(--border)" stroke-width="8" stroke-dasharray="${circumference/2} ${circumference}" stroke-linecap="butt" transform="rotate(-180 50 50)"/>
            <circle cx="50" cy="50" r="40" fill="none" stroke="${color}" stroke-width="8"
                stroke-dasharray="${dash/2} ${circumference - dash/2}"
                stroke-dashoffset="0"
                stroke-linecap="butt"
                transform="rotate(-180 50 50)"
                style="transition:stroke-dasharray 0.8s ease"/>
            <text x="50" y="52" text-anchor="middle" fill="${color}" font-size="18" font-weight="700" font-family="IBM Plex Mono,monospace">${rating}</text>
        </svg>
        <div class="bb-gauge-label" style="color:${color}">${labels[rating] || ''}</div>`;
    }

    function timelineSVG(steps) {
        // steps = [{label, date, done, active}]
        return steps.map((s, i) => `
            <div class="bb-timeline-step ${s.done ? 'bb-tl-done' : ''} ${s.active ? 'bb-tl-active' : ''} ${s.overdue ? 'bb-tl-overdue' : ''}">
                <div class="bb-tl-dot"></div>
                ${i < steps.length-1 ? '<div class="bb-tl-line"></div>' : ''}
                <div class="bb-tl-label">${s.label}</div>
                <div class="bb-tl-date">${s.date || '—'}</div>
            </div>`).join('');
    }

    function statusStepsSVG(steps, current) {
        return steps.map(s => {
            const idx = steps.indexOf(s);
            const curIdx = steps.indexOf(current);
            const done = idx < curIdx;
            const active = idx === curIdx;
            return `<div class="bb-step ${done?'bb-step-done':''} ${active?'bb-step-active':''}">
                <div class="bb-step-dot">${done ? '✓' : idx+1}</div>
                <div class="bb-step-label">${s}</div>
            </div>`;
        }).join('<div class="bb-step-line"></div>');
    }

    function daysRemaining(deadline) {
        if (!deadline) return null;
        const today = new Date(); today.setHours(0,0,0,0);
        const dl = new Date(deadline); dl.setHours(0,0,0,0);
        return Math.ceil((dl - today) / (1000*60*60*24));
    }

    function daysChip(deadline) {
        const d = daysRemaining(deadline);
        if (d === null) return '';
        if (d < 0) return `<span class="bb-days-chip bb-days-overdue">ПРОСРОЧЕНО ${Math.abs(d)} дн.</span>`;
        if (d === 0) return `<span class="bb-days-chip bb-days-today">СЕГОДНЯ ДЕДЛАЙН</span>`;
        if (d <= 3) return `<span class="bb-days-chip bb-days-warn">ОСТАЛОСЬ ${d} дн.</span>`;
        return `<span class="bb-days-chip bb-days-ok">${d} ДНЕЙ ДО ДЕДЛАЙНА</span>`;
    }

    function field(label, value, wide) {
        if (!value && value !== 0) return '';
        return `<div class="bb-detail-field ${wide ? 'bb-detail-field--wide' : ''}">
            <div class="bb-detail-field-label">${label}</div>
            <div class="bb-detail-field-value">${value}</div>
        </div>`;
    }

    function statusBadge(status) {
        const map = {
            'Выявлено':'red','В работе':'yellow','Устранено':'green','Просрочено':'red',
            'В рассмотрении':'yellow','Рассмотрено':'green','Исполнено':'green',
            'Выявлен':'red','Урегулирован':'green','В урегулировании':'yellow',
            'Отправлено':'blue','На согласовании':'yellow','Раскрыт клиенту':'blue',
            'Нарушений не выявлено':'green','Выявлены нарушения':'red','Требует доработки':'yellow',
        };
        const color = map[status] || 'gray';
        const colors = {red:'var(--red)',yellow:'var(--yellow)',green:'var(--green)',blue:'var(--blue)',gray:'var(--text-muted)'};
        return `<span class="bb-status-badge" style="color:${colors[color]};border-color:${colors[color]}">${status}</span>`;
    }

    // --- Renderers per registry type ---

    function renderEventDetail(rec) {
        const today = new Date().toISOString().slice(0,10);
        const isOverdue = rec.deadline && rec.deadline < today && rec.status !== 'Устранено';
        const rating = parseInt(rec.riskRating) || 1;

        const tlSteps = [
            {label:'Событие', date: rec.eventDate, done: !!rec.eventDate, active: !rec.eventDate},
            {label:'Выявление', date: rec.date, done: !!rec.date, active: !rec.date},
            {label:'Дедлайн', date: rec.deadline, done: rec.status === 'Устранено', active: isOverdue, overdue: isOverdue},
            {label:'Устранение', date: rec.remedyDate, done: rec.remedyMark === 'Да, устранено', active: rec.status === 'В работе'},
        ];

        return `
        <div class="bb-overlay-hero">
            <div class="bb-overlay-hero-left">
                <div class="bb-overlay-tag">РЕЕСТР СОБЫТИЙ · ID ${rec.id}</div>
                <div class="bb-overlay-title">${rec.description || '—'}</div>
                <div class="bb-overlay-subtitle">${rec.classification || ''}</div>
                <div class="bb-overlay-badges">
                    ${statusBadge(rec.status || '—')}
                    ${rec.isSubstantial ? '<span class="bb-status-badge" style="color:var(--red);border-color:var(--red)">⚠ СУЩЕСТВЕННОЕ</span>' : ''}
                    ${rec.status !== 'Устранено' ? daysChip(rec.deadline) : ''}
                </div>
            </div>
            <div class="bb-overlay-hero-right">
                <div class="bb-gauge">${riskGaugeSVG(rating)}</div>
            </div>
        </div>

        <div class="bb-overlay-section-title">ХРОНОЛОГИЯ</div>
        <div class="bb-timeline">${timelineSVG(tlSteps)}</div>

        <div class="bb-overlay-section-title">ПРОГРЕСС УСТРАНЕНИЯ</div>
        <div class="bb-steps-row">${statusStepsSVG(['Выявлено','В работе','Устранено'], rec.status || 'Выявлено')}</div>

        <div class="bb-overlay-section-title">ДЕТАЛИ ЗАПИСИ</div>
        <div class="bb-detail-grid">
            ${field('Дата события', rec.eventDate)}
            ${field('Дата выявления', rec.date)}
            ${field('Источник', rec.source)}
            ${field('Наличие предписания', rec.hasOrder)}
            ${field('Ответственный', rec.responsible)}
            ${field('Дедлайн', rec.deadline)}
            ${field('Мероприятия', rec.measures, true)}
            ${field('Реализация мероприятий', rec.measuresDone)}
            ${field('Устранение обстоятельств', rec.remedyMark)}
            ${field('Дата устранения', rec.remedyDate)}
            ${field('Меры по предотвращению', rec.preventionMark)}
            ${field('Дата принятия мер', rec.preventionDate)}
            ${field('Исп. предписаний ЦБ/СРО', rec.orderMark)}
            ${field('Дата исполнения', rec.orderDate)}
            ${field('Вероятность повторения', rec.recurrence)}
        </div>`;
    }

    function renderOrderDetail(rec) {
        const steps = ['В работе','На согласовании','Отправлено','Исполнено'];
        const isDone = ['Исполнено','Отправлено'].includes(rec.status);
        const childOrders = (db.orders || []).filter(o => o.parentId === rec.id);
        const hasChild = childOrders.length > 0;
        return `
        <div class="bb-overlay-hero">
            <div class="bb-overlay-hero-left">
                <div class="bb-overlay-tag">ПРЕДПИСАНИЕ · Вх. № ${rec.number || '—'}</div>
                <div class="bb-overlay-title">${rec.description || '—'}</div>
                <div class="bb-overlay-badges">
                    ${statusBadge(rec.status || '—')}
                    ${!isDone && !hasChild ? daysChip(rec.deadline) : (hasChild && !isDone ? `<span class="bb-days-chip" style="background:var(--muted,#555);color:#ccc">⤷ ДОЧЕРНИХ: ${childOrders.length}</span>` : '')}
                </div>
            </div>
            <div class="bb-overlay-hero-right">
                <div class="bb-big-date">
                    <div class="bb-big-date-label">ПОЛУЧЕНО</div>
                    <div class="bb-big-date-val">${rec.dateIn || '—'}</div>
                    <div class="bb-big-date-label" style="margin-top:12px">ДЕДЛАЙН</div>
                    <div class="bb-big-date-val" style="color:var(--red)">${rec.deadline || '—'}</div>
                </div>
            </div>
        </div>

        <div class="bb-overlay-section-title">ПРОГРЕСС ИСПОЛНЕНИЯ</div>
        <div class="bb-steps-row">${statusStepsSVG(steps, rec.status || 'В работе')}</div>

        <div class="bb-overlay-section-title">ДЕТАЛИ</div>
        <div class="bb-detail-grid">
            ${field('Входящий №', rec.number)}
            ${field('Дата получения', rec.dateIn)}
            ${field('Срок исполнения', rec.deadline)}
            ${field('Ответственный', rec.responsible)}
            ${field('Дата исполнения (факт)', rec.dateDone)}
            ${rec.link ? field('Ссылка на документ', `<a href="${rec.link}" target="_blank" style="color:var(--accent)">${rec.link}</a>`, true) : ''}
        </div>`;
    }

    function renderComplaintDetail(rec) {
        const steps = ['В рассмотрении','Рассмотрено','Направлено в ЦБ/СРО'];
        return `
        <div class="bb-overlay-hero">
            <div class="bb-overlay-hero-left">
                <div class="bb-overlay-tag">ОБРАЩЕНИЕ / ЖАЛОБА · ID ${rec.id}</div>
                <div class="bb-overlay-title">${rec.description || '—'}</div>
                <div class="bb-overlay-badges">
                    ${statusBadge(rec.status || '—')}
                    ${rec.status !== 'Рассмотрено' && rec.status !== 'Направлено в ЦБ/СРО' ? daysChip(rec.deadline) : ''}
                    <span class="bb-status-badge" style="color:var(--blue);border-color:var(--blue)">${rec.channel || ''}</span>
                </div>
            </div>
            <div class="bb-overlay-hero-right">
                <div class="bb-big-date">
                    <div class="bb-big-date-label">ПОЛУЧЕНО</div>
                    <div class="bb-big-date-val">${rec.date || '—'}</div>
                    <div class="bb-big-date-label" style="margin-top:12px">РИСК ВЫЯВЛЕН</div>
                    <div class="bb-big-date-val" style="color:${rec.riskDetected==='Да — внесено в реестр событий'?'var(--red)':'var(--green)'}">${rec.riskDetected === 'Да — внесено в реестр событий' ? 'ДА' : 'НЕТ'}</div>
                </div>
            </div>
        </div>

        <div class="bb-overlay-section-title">ПРОГРЕСС РАССМОТРЕНИЯ</div>
        <div class="bb-steps-row">${statusStepsSVG(steps, rec.status || 'В рассмотрении')}</div>

        <div class="bb-overlay-section-title">ДЕТАЛИ</div>
        <div class="bb-detail-grid">
            ${field('Дата получения', rec.date)}
            ${field('Дедлайн', rec.deadline)}
            ${field('Канал', rec.channel)}
            ${field('Ответственный', rec.responsible)}
            ${field('Регуляторный риск', rec.riskDetected)}
            ${field('Результат рассмотрения', rec.result, true)}
        </div>`;
    }

    function renderCheckDetail(rec) {
        const isViolation = rec.result === 'Выявлены нарушения';
        const isOk = rec.result === 'Нарушений не выявлено';
        const resultColor = isOk ? 'var(--green)' : isViolation ? 'var(--red)' : 'var(--yellow)';
        const resultIcon = isOk ? '✓' : isViolation ? '✗' : '⚠';

        return `
        <div class="bb-overlay-hero">
            <div class="bb-overlay-hero-left">
                <div class="bb-overlay-tag">ПРОВЕРКА · ${rec.date || '—'}</div>
                <div class="bb-overlay-title">${rec.type || '—'}</div>
                <div class="bb-overlay-subtitle">${rec.object || ''}</div>
                <div class="bb-overlay-badges">
                    ${statusBadge(rec.result || '—')}
                    ${rec.fixStatus ? statusBadge(rec.fixStatus) : ''}
                </div>
            </div>
            <div class="bb-overlay-hero-right">
                <div class="bb-result-icon" style="color:${resultColor}">${resultIcon}</div>
                <div class="bb-result-label" style="color:${resultColor}">${rec.result || '—'}</div>
            </div>
        </div>

        ${rec.findings ? `
        <div class="bb-overlay-section-title">ВЫЯВЛЕННЫЕ НАРУШЕНИЯ</div>
        <div class="bb-findings-block">${rec.findings}</div>` : ''}

        ${rec.measures ? `
        <div class="bb-overlay-section-title">ПРИНЯТЫЕ МЕРЫ</div>
        <div class="bb-findings-block" style="border-color:var(--yellow)">${rec.measures}</div>` : ''}

        <div class="bb-overlay-section-title">ДЕТАЛИ</div>
        <div class="bb-detail-grid">
            ${field('Дата проведения', rec.date)}
            ${field('Тип проверки', rec.type)}
            ${field('Объект проверки', rec.object, true)}
            ${field('Проверяющий', rec.inspector)}
            ${field('Статус устранения', rec.fixStatus)}
            ${rec.link ? field('Акт', `<a href="${rec.link}" target="_blank" style="color:var(--accent)">📄 Открыть акт</a>`) : ''}
        </div>`;
    }

    function renderConflictDetail(rec) {
        const riskColors = {Низкий:'var(--green)',Средний:'var(--yellow)',Высокий:'var(--red)'};
        const riskColor = riskColors[rec.risk] || 'var(--text-muted)';
        const steps = ['Выявлен','В урегулировании','Урегулирован','Раскрыт клиенту'];

        return `
        <div class="bb-overlay-hero">
            <div class="bb-overlay-hero-left">
                <div class="bb-overlay-tag">КОНФЛИКТ ИНТЕРЕСОВ · ID ${rec.id}</div>
                <div class="bb-overlay-title">${rec.description || '—'}</div>
                <div class="bb-overlay-badges">
                    ${statusBadge(rec.status || '—')}
                    <span class="bb-status-badge" style="color:${riskColor};border-color:${riskColor}">${rec.risk || ''}</span>
                    <span class="bb-status-badge" style="color:var(--text-secondary);border-color:var(--border)">${rec.type || ''}</span>
                </div>
            </div>
            <div class="bb-overlay-hero-right">
                <div class="bb-risk-level" style="color:${riskColor}">
                    <div class="bb-risk-level-bars">
                        ${[1,2,3].map(i => `<div class="bb-rl-bar ${i <= (rec.risk==='Высокий'?3:rec.risk==='Средний'?2:1) ? 'bb-rl-bar--on' : ''}" style="height:${i*10+10}px;background:${i <= (rec.risk==='Высокий'?3:rec.risk==='Средний'?2:1) ? riskColor : 'var(--border)'}"></div>`).join('')}
                    </div>
                    <div class="bb-risk-level-label">${rec.risk || '—'}</div>
                </div>
            </div>
        </div>

        <div class="bb-overlay-section-title">СТАТУС УРЕГУЛИРОВАНИЯ</div>
        <div class="bb-steps-row">${statusStepsSVG(steps, rec.status || 'Выявлен')}</div>

        <div class="bb-overlay-section-title">ДЕТАЛИ</div>
        <div class="bb-detail-grid">
            ${field('Дата выявления', rec.date)}
            ${field('Вид конфликта', rec.type)}
            ${field('Стороны конфликта', rec.parties)}
            ${field('Уровень риска', rec.risk)}
            ${field('Ответственный', rec.responsible)}
            ${field('Способ урегулирования', rec.resolutionType)}
            ${field('Дата урегулирования', rec.resolvedDate)}
            ${field('Результат', rec.result, true)}
        </div>`;
    }

    function renderAuditDetail(rec) {
        const actionColors = {Создано:'var(--green)',Изменено:'var(--yellow)',Удалено:'var(--red)','Статус изменён':'var(--blue)'};
        const color = actionColors[rec.action] || 'var(--text-muted)';
        return `
        <div class="bb-overlay-hero">
            <div class="bb-overlay-hero-left">
                <div class="bb-overlay-tag">ЛОГ ИЗМЕНЕНИЙ · ${rec.ts || '—'}</div>
                <div class="bb-overlay-title">${rec.section || '—'} — ${rec.details || '—'}</div>
                <div class="bb-overlay-badges">
                    <span class="bb-status-badge" style="color:${color};border-color:${color}">${rec.action || '—'}</span>
                    <span class="bb-status-badge" style="color:var(--text-secondary);border-color:var(--border)">${rec.section || ''}</span>
                </div>
            </div>
            <div class="bb-overlay-hero-right">
                <div class="bb-result-icon" style="color:${color};font-size:36px">${rec.action==='Создано'?'+':rec.action==='Удалено'?'−':'~'}</div>
            </div>
        </div>

        ${rec.before || rec.after ? `
        <div class="bb-overlay-section-title">ИЗМЕНЕНИЯ</div>
        <div class="bb-diff-block">
            <div class="bb-diff-side bb-diff-before">
                <div class="bb-diff-label">БЫЛО</div>
                <div class="bb-diff-text">${rec.before || '—'}</div>
            </div>
            <div class="bb-diff-arrow">→</div>
            <div class="bb-diff-side bb-diff-after">
                <div class="bb-diff-label">СТАЛО</div>
                <div class="bb-diff-text">${rec.after || '—'}</div>
            </div>
        </div>` : ''}

        <div class="bb-overlay-section-title">ДЕТАЛИ</div>
        <div class="bb-detail-grid">
            ${field('Время', rec.ts)}
            ${field('Раздел', rec.section)}
            ${field('Действие', rec.action)}
            ${field('ID объекта', rec.objectId)}
            ${field('Описание', rec.objectDesc, true)}
            ${field('Детали', rec.details, true)}
        </div>`;
    }

    // --- Overlay open/close ---

    function getActionButtons(tbodyId, rec) {
        const editFns = {
            'risk-register-table': () => `<button class="bb-action-btn bb-action-edit" onclick="editEvent(${rec.id});closeDetailOverlay()">✎ РЕДАКТИРОВАТЬ</button>`,
            'orders-table-body':   () => `<button class="bb-action-btn bb-action-edit" onclick="editOrder && editOrder(${rec.id});closeDetailOverlay()">✎ РЕДАКТИРОВАТЬ</button>`,
            'complaints-table-body':() => `<button class="bb-action-btn bb-action-edit" onclick="editComplaint && editComplaint(${rec.id});closeDetailOverlay()">✎ РЕДАКТИРОВАТЬ</button>`,
            'checks-table-body':   () => `<button class="bb-action-btn bb-action-edit" onclick="editCheckRecord && editCheckRecord(${rec.id});closeDetailOverlay()">✎ РЕДАКТИРОВАТЬ</button>`,
            'conflicts-table-body':() => `<button class="bb-action-btn bb-action-edit" onclick="editConflict && editConflict(${rec.id});closeDetailOverlay()">✎ РЕДАКТИРОВАТЬ</button>`,
        };
        const fn = editFns[tbodyId];
        return fn ? fn() : '';
    }

    function openDetailOverlay(tbodyId, rowId) {
        const db = getDb();
        if (!db) return;

        const collections = {
            'risk-register-table':  db.events,
            'orders-table-body':    db.orders,
            'complaints-table-body':db.complaints,
            'checks-table-body':    db.checkRecords,
            'conflicts-table-body': db.conflicts,
            'audit-table-body':     db.auditLog,
        };

        const renderers = {
            'risk-register-table':  renderEventDetail,
            'orders-table-body':    renderOrderDetail,
            'complaints-table-body':renderComplaintDetail,
            'checks-table-body':    renderCheckDetail,
            'conflicts-table-body': renderConflictDetail,
            'audit-table-body':     renderAuditDetail,
        };

        const collection = collections[tbodyId] || [];
        const rec = collection.find(r => String(r.id) === String(rowId));
        if (!rec) return;

        const renderer = renderers[tbodyId];
        if (!renderer) return;

        let overlay = document.getElementById('bb-detail-overlay');
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.id = 'bb-detail-overlay';
            overlay.innerHTML = `
                <div class="bb-overlay-backdrop" onclick="closeDetailOverlay()"></div>
                <div class="bb-overlay-panel">
                    <div class="bb-overlay-header">
                        <div class="bb-overlay-header-left">
                            <span class="bb-overlay-ctrl-tag">CTRL</span>
                            <span id="bb-overlay-module-name">ДЕТАЛЬНАЯ ЗАПИСЬ</span>
                        </div>
                        <button class="bb-overlay-close" onclick="closeDetailOverlay()">✕ ЗАКРЫТЬ [ESC]</button>
                    </div>
                    <div class="bb-overlay-body" id="bb-overlay-body"></div>
                    <div class="bb-overlay-footer" id="bb-overlay-footer"></div>
                </div>`;
            document.body.appendChild(overlay);
        }

        const moduleNames = {
            'risk-register-table':'РЕЕСТР СОБЫТИЙ','orders-table-body':'ПРЕДПИСАНИЯ',
            'complaints-table-body':'ОБРАЩЕНИЯ','checks-table-body':'ПРОВЕРКИ',
            'conflicts-table-body':'КОНФЛИКТЫ ИНТЕРЕСОВ','audit-table-body':'ЛОГ ИЗМЕНЕНИЙ',
        };

        document.getElementById('bb-overlay-module-name').textContent = moduleNames[tbodyId] || 'ЗАПИСЬ';
        document.getElementById('bb-overlay-body').innerHTML = renderer(rec);
        document.getElementById('bb-overlay-footer').innerHTML = getActionButtons(tbodyId, rec);

        overlay.classList.add('bb-overlay--open');
        document.body.style.overflow = 'hidden';
    }

    window.closeDetailOverlay = function() {
        const overlay = document.getElementById('bb-detail-overlay');
        if (overlay) {
            overlay.classList.remove('bb-overlay--open');
            document.body.style.overflow = '';
        }
    };

    /* ============================================================
       10. TABLE ROW CLICK → OPEN OVERLAY
    ============================================================ */
    const TBODY_IDS = [
        'risk-register-table','orders-table-body','complaints-table-body',
        'checks-table-body','conflicts-table-body','audit-table-body',
    ];

    function attachRowClick(row) {
        if (row.dataset.bbExp) return;
        row.dataset.bbExp = '1';
        row.style.cursor = 'pointer';

        row.addEventListener('click', function(e) {
            if (e.target.closest('button, a, select, input, label')) return;
            const tbody = row.closest('tbody');
            const tbodyId = tbody ? tbody.id : '';
            const rowId = row.getAttribute('data-row-id');
            if (rowId && tbodyId) openDetailOverlay(tbodyId, rowId);
        });
    }

    function observeTbodies() {
        TBODY_IDS.forEach(id => {
            const tbody = document.getElementById(id);
            if (!tbody) return;
            tbody.querySelectorAll('tr').forEach(attachRowClick);
            new MutationObserver(() => {
                tbody.querySelectorAll('tr:not([data-bb-exp])').forEach(attachRowClick);
                setTimeout(() => { addStatusDots(); renderRiskBars(); }, 50);
            }).observe(tbody, { childList: true });
        });
    }

    /* ============================================================
       11. SECTION OBSERVER
    ============================================================ */
    function observeSections() {
        document.querySelectorAll('.content-section').forEach(sec => {
            new MutationObserver(muts => {
                muts.forEach(m => {
                    if (m.attributeName === 'class' && sec.classList.contains('active')) {
                        updateStatusBar(sec.id);
                        setTimeout(() => { runCounters(); addStatusDots(); renderRiskBars(); updateOverdueBadge(); observeTbodies(); }, 150);
                    }
                });
            }).observe(sec, { attributes: true, attributeFilter: ['class'] });
        });
    }

    /* ============================================================
       INIT
    ============================================================ */
    function init() {
        createStatusBar();
        setupHotkeys();
        addNavHints();
        setupRipple();
        observeTbodies();
        observeSections();
        setTimeout(() => { runCounters(); addStatusDots(); renderRiskBars(); updateOverdueBadge(); }, 600);
        setInterval(updateOverdueBadge, 30000);
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else setTimeout(init, 100);

})();
