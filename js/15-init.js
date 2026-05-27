// ============================================================
// МОДУЛЬ 15: ИНИЦИАЛИЗАЦИЯ ПРИЛОЖЕНИЯ
// ============================================================
// Этот файл — ТОЧКА ВХОДА. Подключается ПОСЛЕДНИМ.
// Воспроизводит оригинальную цепочку инициализации.
// ============================================================

// --- Первичная инициализация периодов и данных ---
document.addEventListener('DOMContentLoaded', () => {
    if (!db.orders)       db.orders = [];
    if (!db.checkRecords) db.checkRecords = [];
    if (!db.complaints)   db.complaints = [];
    if (!db.conflicts)    db.conflicts = [];
    if (!db.planItems)    db.planItems = [];
    if (!db.auditLog)     db.auditLog = [];

    initAuditLog();
    initDynamicPeriods();
    renderOrders();

    if (document.getElementById('period1')?.options.length > 0) {
        updateMetrics();
    }

    // --- Навигационные обработчики для ленивого рендера ---
    document.querySelectorAll('.nav-link[data-target="section-auditlog"]').forEach(link => {
        link.addEventListener('click', () => { auditPage = 0; setTimeout(renderAuditLog, 50); });
    });
    document.querySelectorAll('.nav-link[data-target="section-conflicts"]').forEach(link => {
        link.addEventListener('click', () => setTimeout(renderConflicts, 50));
    });
    document.querySelectorAll('.nav-link[data-target="section-financials"]').forEach(link => {
        link.addEventListener('click', () => setTimeout(initFinancials, 50));
    });
    document.querySelectorAll('.nav-link[data-target="section-checks"]').forEach(link => {
        link.addEventListener('click', () => {
            switchChecksTab('log');
            setTimeout(renderCheckRecords, 50);
        });
    });
    document.querySelectorAll('.nav-link[data-target="section-main"]').forEach(link => {
        link.addEventListener('click', () => { renderAlertBanners(); populateCBEventSelect(); });
    });
    document.querySelectorAll('.nav-link[data-target="section-knowledge"]').forEach(link => {
        link.addEventListener('click', () => setTimeout(renderKnowledgeItems, 50));
    });
    document.querySelectorAll('.nav-link[data-target="section-cbr-rss"]').forEach(link => {
        link.addEventListener('click', () => {
            setTimeout(() => {
                if (typeof initCbrRss !== 'function') return;
                const alreadyLoaded = rssState && Object.keys(rssState.items || {}).length > 0;
                if (!alreadyLoaded) {
                    initCbrRss();
                } else {
                    renderRssDashboard();
                }
            }, 30);
        });
    });

    _lastSavedSnapshot = JSON.stringify(db);
});

// --- Главный запуск после загрузки всех ресурсов ---
window.onload = function() {
    initDynamicPeriods();
    setupListeners();
    createCharts();

    // Открыть главную страницу
    const mainLink = document.querySelector('.nav-link[data-target="section-main"]');
    if (mainLink) mainLink.click();

    filterAndRenderRegister();
    renderAlertBanners();
    populateCBEventSelect();

    _lastSavedSnapshot = JSON.stringify(db);
};
