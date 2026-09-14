import type { Locale } from './config'

export type SetupDictionary = {
  pageTitle: string
  langUk: string
  langRu: string
  steps: {
    welcome: string
    db: string
    admin: string
    store: string
    design: string
    seo: string
    finish: string
  }
  welcome: {
    title: string
    subtitle: string
    featureDb: string
    featureAdmin: string
    featureStore: string
    featureDelivery: string
    featureSeo: string
    featureDemo: string
  }
  db: {
    title: string
    subtitle: string
    checking: string
    paramsOk: string
    paramsHint: string
    connected: string
    connectedHint: string
    noReply: string
    schema: string
    schemaReady: string
    schemaPending: string
    recheck: string
    checkFailed: string
    unreachable: string
  }
  admin: {
    title: string
    subtitle: string
    name: string
    password: string
    passwordPlaceholder: string
    confirm: string
    nameRequired: string
    emailInvalid: string
    passwordShort: string
    passwordMismatch: string
  }
  store: {
    title: string
    subtitle: string
    name: string
    namePlaceholder: string
    description: string
    descriptionPlaceholder: string
    npKey: string
    npPlaceholder: string
    npHint: string
    nameRequired: string
  }
  design: {
    title: string
    subtitle: string
  }
  seo: {
    title: string
    subtitle: string
    metaTitle: string
    metaTitleFallback: string
    metaTitleWithName: string
    metaDescription: string
    metaDescriptionPlaceholder: string
    gsc: string
    gscPlaceholder: string
    indexing: string
    indexingHint: string
  }
  finish: {
    title: string
    subtitle: string
    variantAria: string
    demoTitle: string
    demoHint: string
    cleanTitle: string
    cleanHint: string
    review: string
    rowAdmin: string
    rowStore: string
    rowDesign: string
    rowDomain: string
    domainAuto: string
    rowIndexing: string
    indexingOn: string
    indexingOff: string
    rowNp: string
    npSet: string
    npUnset: string
    rowVariant: string
    variantDemo: string
    variantClean: string
  }
  nav: {
    back: string
    start: string
    next: string
    complete: string
    setupFailed: string
  }
  errors: {
    alreadyConfigured: string
    emailRequired: string
    alreadyInstalled: string
    invalidPostgres: string
    dbNameRequired: string
    connectFailed: string
    schemaApplyFailed: string
    envSaveFailed: string
  }
  templates: Record<string, string>
  storeDefaultName: string
  database: {
    title: string
    subtitleBefore: string
    subtitleAfter: string
    byFields: string
    byUrl: string
    host: string
    port: string
    database: string
    user: string
    password: string
    ssl: string
    sslHint: string
    url: string
    urlFormat: string
    save: string
    saveFailed: string
    savedSchema: string
    savedExists: string
    restartTitle: string
    restartBody: string
    restartThen: string
    change: string
    check: string
    stillOld: string
  }
}

const uk: SetupDictionary = {
  pageTitle: 'Встановлення магазину',
  langUk: 'Укр',
  langRu: 'Рус',
  steps: {
    welcome: 'Початок',
    db: 'База даних',
    admin: 'Адміністратор',
    store: 'Магазин',
    design: 'Дизайн',
    seo: 'SEO',
    finish: 'Готово',
  },
  welcome: {
    title: 'Встановлення магазину',
    subtitle:
      'Майстер допоможе створити адміністратора і виконати базове налаштування. Це займе менше хвилини.',
    featureDb: 'Перевірка підключення до бази даних',
    featureAdmin: 'Обліковий запис адміністратора',
    featureStore: 'Назва і опис магазину',
    featureDelivery: 'Доставка і оплата (Нова Пошта та ін.)',
    featureSeo: 'Домен і SEO для Google',
    featureDemo: 'Чиста версія або демо-дані',
  },
  db: {
    title: 'База даних',
    subtitle:
      'Перевірка підключення до PostgreSQL. Скрипт працює на будь-якому хостингу — підключення задається змінною DATABASE_URL або на екрані налаштування БД.',
    checking: 'Перевіряємо підключення до бази даних…',
    paramsOk: 'Параметри підключення задані',
    paramsHint: 'DATABASE_URL знайдено в оточенні',
    connected: 'Підключення до бази даних',
    connectedHint: 'Сервер PostgreSQL відповідає',
    noReply: 'Немає відповіді від сервера',
    schema: 'Схема бази даних',
    schemaReady: 'Усі таблиці створені',
    schemaPending: 'Таблиці будуть створені автоматично',
    recheck: 'Перевірити знову',
    checkFailed: 'Не вдалося перевірити підключення',
    unreachable: 'База даних недоступна. Перевірте підключення, перш ніж продовжити.',
  },
  admin: {
    title: 'Адміністратор',
    subtitle: 'Створіть обліковий запис з повним доступом до адмін-центру.',
    name: "Ім'я",
    password: 'Пароль',
    passwordPlaceholder: 'Мінімум 8 символів',
    confirm: 'Повтор пароля',
    nameRequired: "Вкажіть ім'я адміністратора",
    emailInvalid: 'Вкажіть коректний email',
    passwordShort: 'Пароль має бути не коротшим за 8 символів',
    passwordMismatch: 'Паролі не збігаються',
  },
  store: {
    title: 'Магазин',
    subtitle: 'Основні дані магазину. Усе можна змінити пізніше в налаштуваннях.',
    name: 'Назва магазину',
    namePlaceholder: 'Наприклад, Universal Magazine',
    description: 'Опис',
    descriptionPlaceholder: 'Короткий опис магазину',
    npKey: 'API-ключ Нової Пошти (необов’язково)',
    npPlaceholder: 'Для пошуку міст і відділень',
    npHint: 'Потрібен для вибору відділень при оформленні. Можна додати пізніше в розділі «Доставка».',
    nameRequired: 'Вкажіть назву магазину',
  },
  design: {
    title: 'Дизайн магазину',
    subtitle: 'Оберіть оформлення вітрини. Його можна змінити в будь-який момент у налаштуваннях.',
  },
  seo: {
    title: 'SEO для Google',
    subtitle:
      'Дані для пошукових систем. Домен визначається автоматично за адресою сайту. Усе можна змінити пізніше в налаштуваннях.',
    metaTitle: 'Заголовок для Google (meta title)',
    metaTitleFallback: 'Мій магазин — інтернет-магазин',
    metaTitleWithName: '{{name}} — інтернет-магазин',
    metaDescription: 'Опис для Google (meta description)',
    metaDescriptionPlaceholder: 'Короткий опис, який побачать у результатах пошуку',
    gsc: 'Код підтвердження Google Search Console (необов’язково)',
    gscPlaceholder: 'Вміст meta-тега google-site-verification',
    indexing: 'Дозволити індексацію в Google',
    indexingHint:
      'Вимкніть, якщо сайт ще не готовий до запуску — він буде прихований із пошуку (noindex), поки ви не увімкнете індексацію в налаштуваннях.',
  },
  finish: {
    title: 'Майже готово',
    subtitle: 'Оберіть, з чого почати, і завершіть встановлення.',
    variantAria: 'Варіант встановлення',
    demoTitle: 'Демо-версія',
    demoHint: 'З прикладами товарів, категорій і замовлень — одразу видно вітрину в роботі.',
    cleanTitle: 'Чиста версія',
    cleanHint: 'Порожній магазин без демо-даних — для запуску з власним каталогом.',
    review: 'Перевірте дані',
    rowAdmin: 'Адміністратор',
    rowStore: 'Магазин',
    rowDesign: 'Дизайн',
    rowDomain: 'Домен',
    domainAuto: 'визначиться автоматично',
    rowIndexing: 'Індексація Google',
    indexingOn: 'увімкнена',
    indexingOff: 'вимкнена',
    rowNp: 'Нова Пошта',
    npSet: 'ключ вказано',
    npUnset: 'не вказано',
    rowVariant: 'Варіант встановлення',
    variantDemo: 'демо-версія',
    variantClean: 'чиста версія',
  },
  nav: {
    back: 'Назад',
    start: 'Почати',
    next: 'Далі',
    complete: 'Завершити встановлення',
    setupFailed: 'Не вдалося виконати встановлення',
  },
  errors: {
    alreadyConfigured: 'Магазин уже налаштований',
    emailRequired: 'Вкажіть email',
    alreadyInstalled:
      'Встановлення вже виконано. Підключення до БД змінюється через .env.local на сервері.',
    invalidPostgres: 'Вкажіть коректні дані підключення до PostgreSQL',
    dbNameRequired: 'Вкажіть назву бази даних',
    connectFailed: 'Не вдалося підключитися: {{message}}',
    schemaApplyFailed: 'Підключення успішне, але не вдалося застосувати схему: {{message}}',
    envSaveFailed: 'Не вдалося зберегти .env.local: {{message}}',
  },
  templates: {
    classic: 'Класичний',
    warm: 'Теплий',
    'dark-tech': 'Dark Tech',
    elegant: 'Елегантний',
    marketplace: 'Маркетплейс',
    boutique: 'Бутік',
    nordic: 'Мінімал',
    berry: 'Ягідний',
    ocean: 'Океан',
    forest: 'Ліс',
    mint: "М'ята",
  },
  storeDefaultName: 'Мій магазин',
  database: {
    title: 'Підключення до бази даних',
    subtitleBefore: 'Вкажіть дані вашої бази PostgreSQL (наприклад, з OSPanel). Налаштування зберігаються у файлі',
    subtitleAfter: '.',
    byFields: 'За полями',
    byUrl: 'Рядок підключення',
    host: 'Хост',
    port: 'Порт',
    database: 'База даних',
    user: 'Користувач',
    password: 'Пароль',
    ssl: 'SSL-підключення',
    sslHint: 'Для локальної бази (OSPanel) зазвичай вимкнено. Увімкніть для хмарних БД.',
    url: 'Рядок підключення',
    urlFormat: 'Формат: postgresql://користувач:пароль@хост:порт/база',
    save: 'Перевірити і зберегти',
    saveFailed: 'Не вдалося зберегти підключення',
    savedSchema: 'Підключення успішне, схему бази даних створено.',
    savedExists: 'Підключення успішне. Схема вже існує.',
    restartTitle: 'Перезапустіть сервер розробки',
    restartBody:
      'Щоб застосунок використав нове підключення, зупиніть сервер (Ctrl+C у терміналі) і запустіть знову:',
    restartThen: 'Потім натисніть «Перевірити підключення», щоб продовжити встановлення.',
    change: 'Змінити дані',
    check: 'Перевірити підключення',
    stillOld:
      'Застосунок усе ще використовує попереднє підключення. Перезапустіть dev-сервер (Ctrl+C, потім «pnpm dev») і натисніть «Перевірити підключення».',
  },
}

const ru: SetupDictionary = {
  pageTitle: 'Установка магазина',
  langUk: 'Укр',
  langRu: 'Рус',
  steps: {
    welcome: 'Начало',
    db: 'База данных',
    admin: 'Администратор',
    store: 'Магазин',
    design: 'Дизайн',
    seo: 'SEO',
    finish: 'Готово',
  },
  welcome: {
    title: 'Установка магазина',
    subtitle:
      'Мастер поможет создать администратора и выполнить базовую настройку. Это займёт меньше минуты.',
    featureDb: 'Проверка подключения к базе данных',
    featureAdmin: 'Учётная запись администратора',
    featureStore: 'Название и описание магазина',
    featureDelivery: 'Доставка и оплата (Нова Пошта и др.)',
    featureSeo: 'Домен и SEO для Google',
    featureDemo: 'Чистая версия или демо-данные',
  },
  db: {
    title: 'База данных',
    subtitle:
      'Проверка подключения к PostgreSQL. Скрипт работает на любом хостинге — подключение задаётся переменной DATABASE_URL или на экране настройки БД.',
    checking: 'Проверяем подключение к базе данных…',
    paramsOk: 'Параметры подключения заданы',
    paramsHint: 'DATABASE_URL найден в окружении',
    connected: 'Подключение к базе данных',
    connectedHint: 'Сервер PostgreSQL отвечает',
    noReply: 'Нет ответа от сервера',
    schema: 'Схема базы данных',
    schemaReady: 'Все таблицы созданы',
    schemaPending: 'Таблицы будут созданы автоматически',
    recheck: 'Проверить снова',
    checkFailed: 'Не удалось проверить подключение',
    unreachable: 'База данных недоступна. Проверьте подключение, прежде чем продолжить.',
  },
  admin: {
    title: 'Администратор',
    subtitle: 'Создайте учётную запись с полным доступом к админ-центру.',
    name: 'Имя',
    password: 'Пароль',
    passwordPlaceholder: 'Минимум 8 символов',
    confirm: 'Повтор пароля',
    nameRequired: 'Укажите имя администратора',
    emailInvalid: 'Укажите корректный email',
    passwordShort: 'Пароль должен быть не короче 8 символов',
    passwordMismatch: 'Пароли не совпадают',
  },
  store: {
    title: 'Магазин',
    subtitle: 'Основные данные магазина. Всё можно изменить позже в настройках.',
    name: 'Название магазина',
    namePlaceholder: 'Например, Universal Magazine',
    description: 'Описание',
    descriptionPlaceholder: 'Короткое описание магазина',
    npKey: 'API-ключ Нова Пошта (необязательно)',
    npPlaceholder: 'Для поиска городов и отделений',
    npHint: 'Нужен для выбора отделений при оформлении. Можно добавить позже в разделе «Доставка».',
    nameRequired: 'Укажите название магазина',
  },
  design: {
    title: 'Дизайн магазина',
    subtitle: 'Выберите оформление витрины. Его можно сменить в любой момент в настройках.',
  },
  seo: {
    title: 'SEO для Google',
    subtitle:
      'Данные для поисковых систем. Домен определится автоматически по адресу сайта. Всё можно изменить позже в настройках.',
    metaTitle: 'Заголовок для Google (meta title)',
    metaTitleFallback: 'Мой магазин — интернет-магазин',
    metaTitleWithName: '{{name}} — интернет-магазин',
    metaDescription: 'Описание для Google (meta description)',
    metaDescriptionPlaceholder: 'Короткое описание, которое увидят в результатах поиска',
    gsc: 'Код подтверждения Google Search Console (необязательно)',
    gscPlaceholder: 'Содержимое meta-тега google-site-verification',
    indexing: 'Разрешить индексацию в Google',
    indexingHint:
      'Отключите, если сайт ещё не готов к запуску — он будет скрыт из поиска (noindex), пока вы не включите индексацию в настройках.',
  },
  finish: {
    title: 'Почти готово',
    subtitle: 'Выберите, с чего начать, и завершите установку.',
    variantAria: 'Вариант установки',
    demoTitle: 'Демо-версия',
    demoHint: 'С примерами товаров, категорий и заказов — сразу видно витрину в работе.',
    cleanTitle: 'Чистая версия',
    cleanHint: 'Пустой магазин без демо-данных — для запуска с собственным каталогом.',
    review: 'Проверьте данные',
    rowAdmin: 'Администратор',
    rowStore: 'Магазин',
    rowDesign: 'Дизайн',
    rowDomain: 'Домен',
    domainAuto: 'определится автоматически',
    rowIndexing: 'Индексация Google',
    indexingOn: 'включена',
    indexingOff: 'выключена',
    rowNp: 'Нова Пошта',
    npSet: 'ключ указан',
    npUnset: 'не указан',
    rowVariant: 'Вариант установки',
    variantDemo: 'демо-версия',
    variantClean: 'чистая версия',
  },
  nav: {
    back: 'Назад',
    start: 'Начать',
    next: 'Далее',
    complete: 'Завершить установку',
    setupFailed: 'Не удалось выполнить установку',
  },
  errors: {
    alreadyConfigured: 'Магазин уже настроен',
    emailRequired: 'Укажите email',
    alreadyInstalled:
      'Установка уже выполнена. Подключение к БД меняется через .env.local на сервере.',
    invalidPostgres: 'Укажите корректные данные подключения к PostgreSQL',
    dbNameRequired: 'Укажите имя базы данных',
    connectFailed: 'Не удалось подключиться: {{message}}',
    schemaApplyFailed: 'Подключение успешно, но не удалось применить схему: {{message}}',
    envSaveFailed: 'Не удалось сохранить .env.local: {{message}}',
  },
  templates: {
    classic: 'Классический',
    warm: 'Тёплый',
    'dark-tech': 'Dark Tech',
    elegant: 'Элегантный',
    marketplace: 'Маркетплейс',
    boutique: 'Бутик',
    nordic: 'Минимал',
    berry: 'Ягодный',
    ocean: 'Океан',
    forest: 'Лес',
    mint: 'Мята',
  },
  storeDefaultName: 'Мой магазин',
  database: {
    title: 'Подключение к базе данных',
    subtitleBefore: 'Укажите данные вашей базы PostgreSQL (например, из OSPanel). Настройки сохраняются в файле',
    subtitleAfter: '.',
    byFields: 'По полям',
    byUrl: 'Строка подключения',
    host: 'Хост',
    port: 'Порт',
    database: 'База данных',
    user: 'Пользователь',
    password: 'Пароль',
    ssl: 'SSL-подключение',
    sslHint: 'Для локальной базы (OSPanel) обычно выключено. Включите для облачных БД.',
    url: 'Строка подключения',
    urlFormat: 'Формат: postgresql://пользователь:пароль@хост:порт/база',
    save: 'Проверить и сохранить',
    saveFailed: 'Не удалось сохранить подключение',
    savedSchema: 'Подключение успешно, схема базы данных создана.',
    savedExists: 'Подключение успешно. Схема уже существует.',
    restartTitle: 'Перезапустите сервер разработки',
    restartBody:
      'Чтобы приложение использовало новое подключение, остановите сервер (Ctrl+C в терминале) и запустите снова:',
    restartThen: 'Затем нажмите «Проверить подключение», чтобы продолжить установку.',
    change: 'Изменить данные',
    check: 'Проверить подключение',
    stillOld:
      'Приложение всё ещё использует прежнее подключение. Перезапустите dev-сервер (Ctrl+C, затем «pnpm dev») и нажмите «Проверить подключение».',
  },
}

const dictionaries: Record<Locale, SetupDictionary> = { uk, ru }

export function getSetupDictionary(locale: Locale): SetupDictionary {
  return dictionaries[locale] ?? uk
}
