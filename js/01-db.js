// ============================================================
// МОДУЛЬ 01: КОНСТАНТЫ И БАЗА ДАННЫХ
// ============================================================
// Здесь хранится:
// - Справочные константы (месяцы, цвета, и т.д.)
// - Начальные данные (initialDb) — демо-данные при первом запуске
// - Инициализация переменной `db` из localStorage
// - Миграция схемы при обновлениях
// - Глобальные переменные состояния (editingEventId, chart refs)
// ============================================================

const MONTHS = ['Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTH_NAMES = {
    'Jul': 'Июль', 'Aug': 'Август', 'Sep': 'Сентябрь',
    'Oct': 'Октябрь', 'Nov': 'Ноябрь', 'Dec': 'Декабрь'
};

const QUARTERS = {
    'Q3': [6, 7, 8],
    'Q4': [9, 10, 11]
};

const MONTH_INDICES = {
    'Jul': 6, 'Aug': 7, 'Sep': 8,
    'Oct': 9, 'Nov': 10, 'Dec': 11
};

const STATUS_COLORS = {
    'Выявлено': '#D9A86E',
    'В работе': '#F39C12',
    'Устранено': '#2ECC71'
};

// ------ НАЧАЛЬНЫЕ ДАННЫЕ (demo) ------
const initialDb = {
    events: [
        { id: 1, date: '2025-07-10', description: 'Ошибка в расчете норматива (План 1.2)', source: 'Внутренняя проверка', classification: '11.3. Регуляторная отчетность', isSubstantial: false, status: 'Устранено' },
        { id: 2, date: '2025-08-05', description: 'Жалоба клиента на профилирование (План 1.3)', source: 'Жалоба клиента', classification: '6.1. Соответствие предлагаемых продуктов... (профилирование)', isSubstantial: true, status: 'В работе' },
        { id: 3, date: '2025-09-15', description: 'Нарушение сроков ответа на жалобу (План 2 4кв)', source: 'Жалоба клиента', classification: '3.4. Установленные корпоративные процессы по рассмотрению жалоб', isSubstantial: false, status: 'Устранено' },
        { id: 4, date: '2025-10-02', description: 'Не предоставлен отчет по запросу ЦБ', source: 'Запрос ЦБ/СРО', classification: '11.3. Регуляторная отчетность', isSubstantial: true, status: 'Выявлено' }
    ],
    checks: {
        'Jul': { clients: 5, ads: 1 }, 'Aug': { clients: 4, ads: 0 }, 'Sep': { clients: 5, ads: 1 },
        'Oct': { clients: 2, ads: 2 }, 'Nov': { clients: 0, ads: 0 }, 'Dec': { clients: 0, ads: 0 }
    },
    quarterlyReport: {
        'Q3': { probability: 'Средняя', rating: 3 },
        'Q4': { probability: 'Средняя', rating: 4 }
    },
    orders: [
        { id: 1, number: '54-02/199', dateIn: '2025-08-15', source: 'Банк России (ЦБ)', description: 'Запрос документов по ПОД/ФТ', deadline: '2025-08-25', status: 'Отправлено', dateDone: '2025-08-24' }
    ],
    externalLinks: [
        { id: 1, title: 'Банк России (ЦБ)', url: 'https://www.cbr.ru/' },
        { id: 2, title: 'Реестр СРО', url: '#' },
        { id: 3, title: 'Оценка последствий (Пример)', url: '#' }
    ],
    complaints: []
};

// ------ ИНИЦИАЛИЗАЦИЯ БД ------
let db = JSON.parse(localStorage.getItem('controllerDataV3')) || initialDb;

// ------ МИГРАЦИИ СХЕМЫ ------
// Добавить сюда новые миграции при изменении структуры db
if (!db.externalLinks)   { db.externalLinks = initialDb.externalLinks || []; localStorage.setItem('controllerDataV3', JSON.stringify(db)); }
if (!db.orders)          { db.orders = []; }
if (!db.checkRecords)    { db.checkRecords = []; }
if (!db.complaints)      { db.complaints = []; }
if (!db.conflicts)       { db.conflicts = []; }
if (!db.planItems)       { db.planItems = []; }
if (!db.auditLog)        { db.auditLog = []; }
// Миграция: добавить поля дочернего предписания к существующим записям
if (db.orders) {
    db.orders.forEach(o => {
        if (o.parentId === undefined) o.parentId = null;
        if (o.childNumber === undefined) o.childNumber = '';
        if (o.nonComplianceReason === undefined) o.nonComplianceReason = '';
    });
}
if (!db.knowledgeItems)  {
    db.knowledgeItems = [
        { id: 1, title: 'НКД — норматив краткосрочной достаточности', body: 'Показатель достаточности собственных средств для покрытия краткосрочных обязательств. Рассчитывается как отношение высоколиквидных активов к краткосрочным обязательствам. Минимальное значение устанавливается лицензией и Указанием Банка России № 4373-У.' },
        { id: 2, title: 'НКЛ — норматив краткосрочной ликвидности', body: 'Показатель способности организации выполнять краткосрочные обязательства. Отражает отношение ликвидных активов к обязательствам сроком до 30 дней. Регулируется Указанием Банка России № 5436-У.' },
        { id: 3, title: 'Существенное событие регуляторного риска', body: 'Событие, имеющее значительные последствия для деятельности организации: нарушение нормативных требований, предписание регулятора, штраф, приостановление лицензии, судебный иск. Подлежит обязательному уведомлению Банка России согласно п. 2.1.12 Указания № 5683-У в течение 5 рабочих дней.' },
        { id: 4, title: 'Таксономия регуляторного риска', body: 'Классификация событий риска по видам нарушений: 1 — ПОД/ФТ, 2 — Инсайд и манипулирование, 3 — Конфликт интересов, 4 — Раскрытие информации, 5 — Операционный риск, 6.1 — Профилирование клиентов, 7 — Лицензионные требования. Классификация ведётся согласно ПВК организации.' },
        { id: 5, title: 'EWMA — экспоненциально взвешенное скользящее среднее', body: 'Метод прогнозирования трендов нормативов, применяемый в системе мониторинга. Последние наблюдения имеют больший вес (α=0.85). Используется для раннего предупреждения о приближении к минимальным значениям нормативов. Методология основана на стандарте RiskMetrics.' },
        { id: 6, title: 'Конфликт интересов', body: 'Ситуация, при которой личные интересы сотрудника или аффилированных лиц могут повлиять на исполнение профессиональных обязанностей в ущерб интересам клиентов или организации. Подлежит раскрытию и урегулированию согласно ст. 10 Федерального закона № 39-ФЗ и внутреннему ПВК.' },
        { id: 7, title: 'Предписание регулятора', body: 'Обязательный для исполнения документ Банка России или СРО, содержащий требования об устранении выявленных нарушений. Сроки исполнения — строго по тексту предписания. Неисполнение влечёт приостановление или аннулирование лицензии. Контролируется в разделе «Предписания ЦБ/СРО».' },
    ];
}

// ------ ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ СОСТОЯНИЯ ------
let eventIdToDelete = null;
let editingEventId = null;
let _lastSavedSnapshot = JSON.stringify(db);

// Ссылки на объекты Chart.js (инициализируются в 03-charts.js)
let riskStatusChart, riskTaxonomyChart, controlTrendChart, kpiComparisonChart, ganttChart;
let financialsNkdChart = null;
let financialsNklChart = null;
let financialsEquityChart = null;

// ------ SHARED CONFIG ------
const mandatoryTooltipConfig = {
    plugins: {
        tooltip: {
            callbacks: {
                title: function(tooltipItems) {
                    const item = tooltipItems[0];
                    let label = item.chart.data.labels[item.dataIndex];
                    return Array.isArray(label) ? label.join(' ') : label;
                }
            }
        }
    }
};
