// ============================================================
// МОДУЛЬ 18: МОНИТОРИНГ RSS БАНКА РОССИИ
// ============================================================
// initCbrRss()           — инициализация модуля, загрузка настроек
// loadAllFeeds()         — загрузка всех активных лент через CORS-прокси
// renderRssFeed()        — отрисовка ленты в карточках
// renderRssDashboard()   — главная страница модуля
// markItemRead()         — отметить как прочитанное
// toggleFeedActive()     — вкл/выкл ленту
// searchRssItems()       — поиск по всем загруженным материалам
// exportRssToExcel()     — экспорт новостей в Excel
// ============================================================

// ------ КОНФИГУРАЦИЯ ЛЕНТ ------
const CBR_RSS_FEEDS = [
    {
        id: 'news_ru',
        title: 'Новое на сайте',
        url: 'https://www.cbr.ru/rss/RssNews',
        lang: 'ru',
        category: 'news',
        icon: '📰',
        color: '#4B4240',
        active: true
    },
    {
        id: 'events_ru',
        title: 'Новости, интервью, выступления',
        url: 'https://www.cbr.ru/rss/eventrss',
        lang: 'ru',
        category: 'events',
        icon: '🎤',
        color: '#D9A86E',
        active: true
    },
    {
        id: 'press_ru',
        title: 'Пресс-релизы',
        url: 'https://www.cbr.ru/rss/RssPress',
        lang: 'ru',
        category: 'press',
        icon: '📋',
        color: '#7D7471',
        active: true
    },
    {
        id: 'currency_ru',
        title: 'Курсы валют (ежедневно)',
        url: 'https://www.cbr.ru/rss/RssCurrency',
        lang: 'ru',
        category: 'currency',
        icon: '💱',
        color: '#27AE60',
        active: true
    },
    {
        id: 'mci_ru',
        title: 'Регламент эл. документов (МЦИ)',
        url: 'https://www.cbr.ru/rss/nregimr2',
        lang: 'ru',
        category: 'mci',
        icon: '🖥️',
        color: '#2980B9',
        active: false
    },
    {
        id: 'news_en',
        title: "What's new (English)",
        url: 'https://www.cbr.ru/rss/EngRssNews',
        lang: 'en',
        category: 'news',
        icon: '🌐',
        color: '#8E44AD',
        active: false
    },
    {
        id: 'events_en',
        title: 'News & speeches (English)',
        url: 'https://www.cbr.ru/rss/engeventrss',
        lang: 'en',
        category: 'events',
        icon: '🌐',
        color: '#8E44AD',
        active: false
    },
    {
        id: 'press_en',
        title: 'Press releases (English)',
        url: 'https://www.cbr.ru/rss/EngRssPress',
        lang: 'en',
        category: 'press',
        icon: '🌐',
        color: '#8E44AD',
        active: false
    }
];

// CORS-прокси для получения RSS из браузера
const RSS_PROXY = 'https://api.allorigins.win/get?url=';

// ------ СОСТОЯНИЕ МОДУЛЯ ------
let rssState = {
    items: {},          // feedId -> [{title, link, pubDate, description, read}]
    loading: {},        // feedId -> bool
    errors: {},         // feedId -> string
    lastFetch: {},      // feedId -> timestamp
    feedSettings: {},   // feedId -> {active: bool}
    autoRefreshTimer: null,
    autoRefreshInterval: 30, // минут
    filterCategory: 'all',
    filterRead: 'all',
    searchQuery: '',
    activeTab: 'feed'   // 'feed' | 'settings'
};

// ------ ИНИЦИАЛИЗАЦИЯ ------
function initCbrRss() {
    // Загрузить настройки из db (сохранённые пользователем)
    if (db.cbrRss) {
        rssState.feedSettings = db.cbrRss.feedSettings || {};
        rssState.autoRefreshInterval = db.cbrRss.autoRefreshInterval || 30;
    }

    // Применить сохранённые настройки active к лентам
    CBR_RSS_FEEDS.forEach(feed => {
        if (rssState.feedSettings[feed.id] !== undefined) {
            feed.active = rssState.feedSettings[feed.id];
        }
    });

    renderRssDashboard();
    loadAllFeeds();
    scheduleAutoRefresh();
}

function saveRssSettings() {
    rssState.feedSettings = {};
    CBR_RSS_FEEDS.forEach(f => { rssState.feedSettings[f.id] = f.active; });
    db.cbrRss = db.cbrRss || {};
    db.cbrRss.feedSettings = rssState.feedSettings;
    db.cbrRss.autoRefreshInterval = rssState.autoRefreshInterval;
    saveDb();
}

// ------ ЗАГРУЗКА ЛЕНТ ------
async function loadFeed(feed) {
    rssState.loading[feed.id] = true;
    rssState.errors[feed.id] = null;
    updateFeedLoadingUI(feed.id, true);

    try {
        const proxyUrl = RSS_PROXY + encodeURIComponent(feed.url);
        const response = await fetch(proxyUrl);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        const data = await response.json();
        const xmlText = data.contents;

        const parser = new DOMParser();
        const xml = parser.parseFromString(xmlText, 'application/xml');

        // Проверка на ошибку парсинга
        if (xml.querySelector('parsererror')) {
            throw new Error('Ошибка разбора XML');
        }

        const items = Array.from(xml.querySelectorAll('item')).map(item => {
            const title = item.querySelector('title')?.textContent?.trim() || '(без заголовка)';
            const link = item.querySelector('link')?.textContent?.trim() || '';
            const pubDate = item.querySelector('pubDate')?.textContent?.trim() || '';
            const desc = item.querySelector('description')?.textContent?.trim() || '';

            // Убираем HTML-теги из описания
            const cleanDesc = desc.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();

            return {
                id: btoa(encodeURIComponent(link + title)).slice(0, 32),
                title,
                link,
                pubDate: pubDate ? new Date(pubDate) : null,
                description: cleanDesc.slice(0, 300),
                read: isItemRead(feed.id, link + title)
            };
        });

        rssState.items[feed.id] = items;
        rssState.lastFetch[feed.id] = Date.now();
        rssState.loading[feed.id] = false;

        updateFeedLoadingUI(feed.id, false);
        renderFeedItems(feed.id);
        updateRssCounters();

    } catch (err) {
        rssState.errors[feed.id] = err.message;
        rssState.loading[feed.id] = false;
        updateFeedLoadingUI(feed.id, false, err.message);
    }
}

async function loadAllFeeds() {
    const activeFeeds = CBR_RSS_FEEDS.filter(f => f.active);
    for (const feed of activeFeeds) {
        await loadFeed(feed);
    }
}

// ------ ОТМЕТКИ «ПРОЧИТАНО» (хранятся в localStorage) ------
function getReadSet() {
    try {
        return new Set(JSON.parse(localStorage.getItem('cbr_rss_read') || '[]'));
    } catch { return new Set(); }
}
function saveReadSet(set) {
    try { localStorage.setItem('cbr_rss_read', JSON.stringify([...set])); } catch {}
}
function isItemRead(feedId, key) {
    return getReadSet().has(feedId + '::' + key);
}
function markItemRead(feedId, key) {
    const set = getReadSet();
    set.add(feedId + '::' + key);
    saveReadSet(set);
    // Обновить состояние
    if (rssState.items[feedId]) {
        rssState.items[feedId].forEach(item => {
            if ((item.link + item.title) === key) item.read = true;
        });
    }
    updateRssCounters();
}
function markAllRead(feedId) {
    const set = getReadSet();
    (rssState.items[feedId] || []).forEach(item => {
        set.add(feedId + '::' + (item.link + item.title));
        item.read = true;
    });
    saveReadSet(set);
    renderFeedItems(feedId);
    updateRssCounters();
}
function markAllFeedsRead() {
    CBR_RSS_FEEDS.forEach(feed => markAllRead(feed.id));
    renderRssFeedView();
}

// ------ АВТО-ОБНОВЛЕНИЕ ------
function scheduleAutoRefresh() {
    if (rssState.autoRefreshTimer) clearInterval(rssState.autoRefreshTimer);
    if (rssState.autoRefreshInterval > 0) {
        rssState.autoRefreshTimer = setInterval(() => {
            loadAllFeeds();
        }, rssState.autoRefreshInterval * 60 * 1000);
    }
}

// ------ РЕНДЕР ГЛАВНОЙ СТРАНИЦЫ МОДУЛЯ ------
function renderRssDashboard() {
    const section = document.getElementById('section-cbr-rss');
    if (!section) return;

    section.innerHTML = `
        <div class="flex flex-wrap justify-between items-start gap-3 mb-6">
            <div>
                <h1 class="text-3xl font-bold text-[#4B4240]">Мониторинг RSS Банка России</h1>
                <p class="text-[#7D7471] mt-1">Автоматическое отслеживание новостей, пресс-релизов и курсов валют ЦБ РФ.</p>
            </div>
            <div class="flex gap-2 flex-wrap">
                <button onclick="loadAllFeeds()" class="flex items-center gap-2 bg-[#4B4240] text-white py-2 px-4 rounded-lg hover:bg-[#2c2625] transition text-sm font-semibold shadow-sm">
                    <span>🔄</span> Обновить всё
                </button>
                <button onclick="markAllFeedsRead()" class="flex items-center gap-2 border border-[#4B4240] text-[#4B4240] py-2 px-4 rounded-lg hover:bg-[#EFEFEF] transition text-sm">
                    <span>✓</span> Отметить все прочитанными
                </button>
                <button onclick="exportRssToExcel()" class="flex items-center gap-2 bg-[#27AE60] text-white py-2 px-4 rounded-lg hover:bg-[#219150] transition text-sm font-semibold">
                    <span>📥</span> Excel
                </button>
            </div>
        </div>

        <!-- Вкладки -->
        <div class="flex gap-2 mb-6 border-b border-[#E0E0E0]">
            <button id="rss-tab-feed" onclick="switchRssTab('feed')"
                class="px-5 py-2 text-sm font-semibold border-b-2 border-[#D9A86E] text-[#D9A86E] transition">
                📡 Лента новостей
            </button>
            <button id="rss-tab-settings" onclick="switchRssTab('settings')"
                class="px-5 py-2 text-sm font-semibold border-b-2 border-transparent text-[#7D7471] hover:text-[#4B4240] transition">
                ⚙️ Настройки лент
            </button>
        </div>

        <!-- Счётчики -->
        <div id="rss-counters" class="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
            ${CBR_RSS_FEEDS.filter(f=>f.active).map(f => `
            <div class="bg-white rounded-xl shadow-sm p-4 text-center border-l-4" style="border-left-color:${f.color}">
                <p class="text-2xl font-bold text-[#4B4240]" id="rss-count-${f.id}">—</p>
                <p class="text-xs text-[#7D7471] uppercase tracking-wide mt-1">${f.icon} ${f.title.slice(0,22)}...</p>
                <p class="text-xs text-red-500 font-semibold mt-1" id="rss-unread-${f.id}"></p>
            </div>`).join('')}
        </div>

        <!-- Поиск и фильтры -->
        <div class="bg-white p-4 rounded-xl shadow-sm mb-4 flex flex-wrap gap-3 items-end">
            <div class="flex flex-col flex-1 min-w-[200px]">
                <label class="text-xs text-[#7D7471] mb-1">Поиск по заголовкам</label>
                <input type="text" id="rss-search" oninput="rssState.searchQuery=this.value; renderRssFeedView()"
                    placeholder="Ключевое слово..." class="p-2 border border-[#A69C97] rounded text-sm">
            </div>
            <div class="flex flex-col">
                <label class="text-xs text-[#7D7471] mb-1">Категория</label>
                <select id="rss-filter-cat" onchange="rssState.filterCategory=this.value; renderRssFeedView()"
                    class="p-2 border border-[#A69C97] rounded bg-white text-sm">
                    <option value="all">Все</option>
                    <option value="news">Новости</option>
                    <option value="events">События/Выступления</option>
                    <option value="press">Пресс-релизы</option>
                    <option value="currency">Курсы валют</option>
                    <option value="mci">МЦИ</option>
                </select>
            </div>
            <div class="flex flex-col">
                <label class="text-xs text-[#7D7471] mb-1">Статус</label>
                <select id="rss-filter-read" onchange="rssState.filterRead=this.value; renderRssFeedView()"
                    class="p-2 border border-[#A69C97] rounded bg-white text-sm">
                    <option value="all">Все</option>
                    <option value="unread">Непрочитанные</option>
                    <option value="read">Прочитанные</option>
                </select>
            </div>
        </div>

        <!-- Лента / Настройки (переключаемые панели) -->
        <div id="rss-panel-feed">
            <div id="rss-feed-container"></div>
        </div>
        <div id="rss-panel-settings" class="hidden">
            ${renderRssSettingsPanel()}
        </div>
    `;

    renderRssFeedView();
}

function switchRssTab(tab) {
    rssState.activeTab = tab;
    document.getElementById('rss-panel-feed').classList.toggle('hidden', tab !== 'feed');
    document.getElementById('rss-panel-settings').classList.toggle('hidden', tab !== 'settings');

    document.getElementById('rss-tab-feed').className =
        tab === 'feed'
        ? 'px-5 py-2 text-sm font-semibold border-b-2 border-[#D9A86E] text-[#D9A86E] transition'
        : 'px-5 py-2 text-sm font-semibold border-b-2 border-transparent text-[#7D7471] hover:text-[#4B4240] transition';
    document.getElementById('rss-tab-settings').className =
        tab === 'settings'
        ? 'px-5 py-2 text-sm font-semibold border-b-2 border-[#D9A86E] text-[#D9A86E] transition'
        : 'px-5 py-2 text-sm font-semibold border-b-2 border-transparent text-[#7D7471] hover:text-[#4B4240] transition';
}

// ------ ЛЕНТА: РЕНДЕР КАРТОЧЕК ------
function renderRssFeedView() {
    const container = document.getElementById('rss-feed-container');
    if (!container) return;

    const activeFeeds = CBR_RSS_FEEDS.filter(f => {
        if (!f.active) return false;
        if (rssState.filterCategory !== 'all' && f.category !== rssState.filterCategory) return false;
        return true;
    });

    if (activeFeeds.length === 0) {
        container.innerHTML = `<div class="text-center py-12 text-[#A69C97] italic">Нет активных лент в выбранной категории. <button onclick="switchRssTab('settings')" class="text-[#D9A86E] underline">Включить ленты →</button></div>`;
        return;
    }

    container.innerHTML = activeFeeds.map(feed => {
        const items = rssState.items[feed.id] || [];
        const loading = rssState.loading[feed.id];
        const error = rssState.errors[feed.id];

        return `
        <div class="bg-white rounded-xl shadow-md mb-6 overflow-hidden">
            <div class="flex items-center justify-between px-5 py-3 border-b border-[#E0E0E0]" style="border-left: 4px solid ${feed.color}">
                <div class="flex items-center gap-2">
                    <span class="text-lg">${feed.icon}</span>
                    <span class="font-semibold text-[#4B4240]">${feed.title}</span>
                    ${loading ? '<span class="text-xs text-[#A69C97] animate-pulse">загружается...</span>' : ''}
                    ${error ? `<span class="text-xs text-red-500" title="${error}">⚠ ошибка</span>` : ''}
                </div>
                <div class="flex items-center gap-2">
                    <span class="text-xs text-[#A69C97]" id="rss-lastfetch-${feed.id}">
                        ${rssState.lastFetch[feed.id] ? 'обновлено ' + new Date(rssState.lastFetch[feed.id]).toLocaleTimeString('ru') : ''}
                    </span>
                    <button onclick="markAllRead('${feed.id}')" class="text-xs text-[#7D7471] hover:text-[#4B4240] transition px-2 py-1 rounded border border-[#E0E0E0] hover:border-[#A69C97]">
                        ✓ Все прочитано
                    </button>
                    <button onclick="loadFeed(CBR_RSS_FEEDS.find(f=>f.id==='${feed.id}'))" class="text-xs text-[#D9A86E] hover:text-[#4B4240] transition px-2 py-1 rounded border border-[#E0D0B0] hover:border-[#A69C97]">
                        🔄
                    </button>
                </div>
            </div>
            <div id="rss-items-${feed.id}" class="divide-y divide-[#F0EDE8]">
                ${renderFeedItemsHTML(feed.id)}
            </div>
        </div>`;
    }).join('');
}

function renderFeedItems(feedId) {
    const el = document.getElementById(`rss-items-${feedId}`);
    if (el) el.innerHTML = renderFeedItemsHTML(feedId);
    updateFeedLoadingUI(feedId, false);
    updateRssCounters();
}

function renderFeedItemsHTML(feedId) {
    const feed = CBR_RSS_FEEDS.find(f => f.id === feedId);
    const allItems = rssState.items[feedId] || [];
    const loading = rssState.loading[feedId];
    const error = rssState.errors[feedId];

    if (loading) return `<div class="p-6 text-center text-[#A69C97] italic">⏳ Загружаем ленту...</div>`;
    if (error) return `
        <div class="p-6 text-center">
            <p class="text-red-500 mb-2">⚠ Не удалось загрузить ленту</p>
            <p class="text-xs text-[#A69C97] mb-3">${error}</p>
            <p class="text-xs text-[#A69C97]">RSS-ленты ЦБ РФ загружаются через CORS-прокси. Если прокси недоступен — попробуйте позже или проверьте соединение.</p>
            <button onclick="loadFeed(CBR_RSS_FEEDS.find(f=>f.id==='${feedId}'))" class="mt-3 text-sm text-[#D9A86E] underline">Повторить</button>
        </div>`;
    if (allItems.length === 0) return `<div class="p-6 text-center text-[#A69C97] italic">Нет элементов</div>`;

    // Применяем фильтры поиска и прочитанности
    let items = allItems;
    if (rssState.searchQuery.trim()) {
        const q = rssState.searchQuery.toLowerCase();
        items = items.filter(i => i.title.toLowerCase().includes(q) || i.description.toLowerCase().includes(q));
    }
    if (rssState.filterRead === 'unread') items = items.filter(i => !i.read);
    if (rssState.filterRead === 'read')   items = items.filter(i => i.read);

    if (items.length === 0) return `<div class="p-4 text-center text-[#A69C97] italic text-sm">Нет элементов по выбранным фильтрам</div>`;

    // Показываем максимум 20 элементов
    const shown = items.slice(0, 20);
    const more = items.length - shown.length;

    return shown.map(item => {
        const dateStr = item.pubDate ? item.pubDate.toLocaleDateString('ru', {day:'2-digit',month:'short',year:'numeric'}) : '';
        const key = item.link + item.title;
        const readClass = item.read ? 'opacity-60' : '';
        const readDot = item.read ? '' : `<span class="inline-block w-2 h-2 rounded-full bg-[#D9A86E] mr-2 flex-shrink-0 mt-1.5"></span>`;

        return `
        <div class="flex items-start gap-3 px-5 py-3 hover:bg-[#FDFBF8] transition group ${readClass}" onclick="markItemRead('${feedId}', '${key.replace(/'/g,"\\'")}'); this.classList.add('opacity-60'); this.querySelector('.read-dot')?.remove();">
            ${readDot ? `<span class="read-dot inline-block w-2 h-2 rounded-full bg-[#D9A86E] mt-1.5 flex-shrink-0"></span>` : '<span class="w-2 flex-shrink-0"></span>'}
            <div class="flex-1 min-w-0">
                <a href="${item.link}" target="_blank" rel="noopener"
                   class="text-sm font-medium text-[#4B4240] hover:text-[#D9A86E] transition line-clamp-2 block leading-snug"
                   onclick="event.stopPropagation(); markItemRead('${feedId}', '${key.replace(/'/g,"\\'")}')">
                    ${item.title}
                </a>
                ${item.description ? `<p class="text-xs text-[#7D7471] mt-0.5 line-clamp-2">${item.description}</p>` : ''}
            </div>
            <div class="flex-shrink-0 text-xs text-[#A69C97] whitespace-nowrap mt-0.5">${dateStr}</div>
        </div>`;
    }).join('') + (more > 0 ? `<div class="p-3 text-center text-xs text-[#A69C97]">...ещё ${more} элементов (применён фильтр)</div>` : '');
}

// ------ ОБНОВЛЕНИЕ СЧЁТЧИКОВ ------
function updateRssCounters() {
    CBR_RSS_FEEDS.forEach(feed => {
        const countEl = document.getElementById(`rss-count-${feed.id}`);
        const unreadEl = document.getElementById(`rss-unread-${feed.id}`);
        if (!countEl) return;

        const items = rssState.items[feed.id] || [];
        const unread = items.filter(i => !i.read).length;
        countEl.textContent = rssState.loading[feed.id] ? '⏳' : (rssState.errors[feed.id] ? '⚠' : items.length);
        if (unreadEl) unreadEl.textContent = unread > 0 ? `${unread} непрочитано` : '';
    });
    // Обновить бейдж в навигации
    const allUnread = CBR_RSS_FEEDS
        .filter(f => f.active)
        .reduce((sum, feed) => sum + (rssState.items[feed.id] || []).filter(i => !i.read).length, 0);
    const badge = document.getElementById('rss-nav-badge');
    if (badge) {
        badge.textContent = allUnread;
        badge.classList.toggle('hidden', allUnread === 0);
    }
}

function updateFeedLoadingUI(feedId, loading, error) {
    // Обновляем заголовок карточки ленты если она уже отрисована
    const lastFetchEl = document.getElementById(`rss-lastfetch-${feedId}`);
    if (lastFetchEl && !loading && rssState.lastFetch[feedId]) {
        lastFetchEl.textContent = 'обновлено ' + new Date(rssState.lastFetch[feedId]).toLocaleTimeString('ru');
    }
}

// ------ НАСТРОЙКИ ЛЕНТ ------
function renderRssSettingsPanel() {
    return `
    <div class="bg-white rounded-xl shadow-md p-6 mb-6">
        <h2 class="text-xl font-semibold mb-4 text-[#4B4240]">Управление лентами</h2>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            ${CBR_RSS_FEEDS.map(feed => `
            <div class="flex items-center justify-between p-3 border border-[#E0E0E0] rounded-lg hover:border-[#A69C97] transition">
                <div class="flex items-center gap-3">
                    <span class="text-xl">${feed.icon}</span>
                    <div>
                        <p class="text-sm font-medium text-[#4B4240]">${feed.title}</p>
                        <p class="text-xs text-[#A69C97]">${feed.lang === 'en' ? '🇬🇧 English' : '🇷🇺 Русский'} · ${feed.category}</p>
                    </div>
                </div>
                <label class="relative inline-flex items-center cursor-pointer ml-3">
                    <input type="checkbox" ${feed.active ? 'checked' : ''} class="sr-only peer"
                        onchange="toggleFeedActive('${feed.id}', this.checked)">
                    <div class="w-10 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#D9A86E]"></div>
                </label>
            </div>`).join('')}
        </div>

        <div class="border-t border-[#E0E0E0] pt-4">
            <h3 class="text-sm font-semibold text-[#4B4240] mb-3">Авто-обновление</h3>
            <div class="flex items-center gap-3">
                <label class="text-sm text-[#7D7471]">Интервал обновления:</label>
                <select id="rss-auto-interval" onchange="rssState.autoRefreshInterval=+this.value; saveRssSettings(); scheduleAutoRefresh()"
                    class="p-2 border border-[#A69C97] rounded bg-white text-sm">
                    <option value="0" ${rssState.autoRefreshInterval===0?'selected':''}>Отключено</option>
                    <option value="15" ${rssState.autoRefreshInterval===15?'selected':''}>15 минут</option>
                    <option value="30" ${rssState.autoRefreshInterval===30?'selected':''}>30 минут</option>
                    <option value="60" ${rssState.autoRefreshInterval===60?'selected':''}>1 час</option>
                    <option value="180" ${rssState.autoRefreshInterval===180?'selected':''}>3 часа</option>
                </select>
            </div>
        </div>

        <div class="border-t border-[#E0E0E0] pt-4 mt-4">
            <h3 class="text-sm font-semibold text-[#4B4240] mb-2">Прямые ссылки на RSS</h3>
            <div class="space-y-2">
                ${CBR_RSS_FEEDS.map(f => `
                <div class="flex items-center gap-2 text-xs">
                    <span class="text-[#7D7471] w-48 flex-shrink-0">${f.icon} ${f.title}</span>
                    <a href="${f.url}" target="_blank" class="text-[#D9A86E] hover:underline truncate">${f.url}</a>
                </div>`).join('')}
            </div>
        </div>
    </div>`;
}

function toggleFeedActive(feedId, active) {
    const feed = CBR_RSS_FEEDS.find(f => f.id === feedId);
    if (!feed) return;
    feed.active = active;
    saveRssSettings();

    // Перестроить счётчики и при включении — загрузить ленту
    renderRssDashboard();
    if (active) loadFeed(feed);
}

// ------ ЭКСПОРТ В EXCEL ------
function exportRssToExcel() {
    if (typeof ExcelJS === 'undefined') { alert('ExcelJS не загружен'); return; }

    const workbook = new ExcelJS.Workbook();

    CBR_RSS_FEEDS.filter(f => f.active && rssState.items[f.id]?.length).forEach(feed => {
        const sheet = workbook.addWorksheet(feed.title.slice(0, 31));
        sheet.addRow(['Заголовок', 'Дата публикации', 'Ссылка', 'Описание', 'Прочитано']);

        (rssState.items[feed.id] || []).forEach(item => {
            sheet.addRow([
                item.title,
                item.pubDate ? item.pubDate.toLocaleDateString('ru') : '',
                item.link,
                item.description,
                item.read ? 'Да' : 'Нет'
            ]);
        });

        sheet.columns.forEach(col => { col.width = 30; });
    });

    workbook.xlsx.writeBuffer().then(buf => {
        saveAs(new Blob([buf]), `cbr_rss_${new Date().toISOString().slice(0,10)}.xlsx`);
    });
}

// ------ ПАТЧ: перехватываем клики по nav-ссылке после полной загрузки страницы ------
document.addEventListener('DOMContentLoaded', () => {
    // Делегируем на document — надёжно работает независимо от порядка скриптов
    document.addEventListener('click', function(e) {
        const link = e.target.closest('.nav-link[data-target="section-cbr-rss"]');
        if (!link) return;
        setTimeout(() => {
            const alreadyLoaded = Object.keys(rssState.items || {}).length > 0;
            if (!alreadyLoaded) {
                initCbrRss();
            } else {
                renderRssDashboard();
            }
        }, 50);
    });
});
