import type { Locale } from '@/lib/i18n/config'

/**
 * Admin-center dictionary. Deliberately separate from the storefront
 * dictionary (lib/i18n/dictionaries.ts): the admin center is a different
 * surface (internal staff tool, not SEO'd, no /ru URL prefix) and only needs
 * chrome/common strings translated incrementally, page by page, without
 * risking the shop's translations.
 *
 * Coverage so far: sidebar navigation, account menu, language switcher, and a
 * "common" bucket of generic action words for reuse across admin pages.
 * Extend this dictionary (and read it from individual admin pages) as more
 * screens get localized — see lib/i18n/admin/README.md.
 */
export type AdminDictionary = {
  common: {
    save: string
    cancel: string
    delete: string
    edit: string
    add: string
    search: string
    filter: string
    actions: string
    yes: string
    no: string
    loading: string
    confirm: string
    close: string
    back: string
    language: string
  }
  sidebar: {
    goToSite: string
    adminCenter: string
    mainNav: string
    signOut: string
    signingOut: string
  }
  navSections: Record<string, string>
  navItems: Record<string, string>
  roles: Record<string, string>
  orders: {
    listTitle: string
    listSubtitle: string
    createOrder: string
    searchPlaceholder: string
    statusPlaceholder: string
    allStatuses: string
    notFoundTitle: string
    notFoundSubtitle: string
    back: string
    next: string
    pageOf: string
    statTotal: string
    statNew: string
    statActive: string
    statRevenue: string
    backToOrdersAria: string
    orderNumber: string
    orderCompleted: string
    paidWith: string
    itemsInOrder: string
    sku: string
    units: string
    customer: string
    payment: string
    paymentNotSelected: string
    delivery: string
    method: string
    address: string
    cost: string
    trackingLabel: string
    saveTracking: string
    history: string
    total: string
    itemsCountLabel: string
    discount: string
    toPay: string
    actions: string
    writeToCustomer: string
    notes: string
    notePlaceholder: string
    save: string
    tags: string
    newOrder: string
    saveOrder: string
    addItem: string
    noItemsYet: string
    stockLabel: string
    name: string
    namePlaceholder: string
    phone: string
    phonePlaceholder: string
    emailLabel: string
    emailPlaceholder: string
    notSelectedOption: string
    city: string
    branch: string
    tagsHint: string
    removeTagAria: string
    newTagPlaceholder: string
    searchDialogPlaceholder: string
    searching: string
    nothingFound: string
    toastStatusUpdated: string
    toastPaymentUpdated: string
    toastTrackingSaved: string
    toastNoteSaved: string
    toastError: string
    toastSendError: string
    toastOpeningMessenger: string
    toastEmailSent: string
    toastNetworkError: string
    toastProductAdded: string
    toastAddAtLeastOneItem: string
    toastOrderCreated: string
    toastCreateFailed: string
  }
  paymentMethods: {
    online: string
    cod: string
    prepay: string
    cash: string
  }
  deliveryMethods: {
    nova_poshta: string
    ukrposhta: string
    courier: string
    pickup: string
  }
  messengers: {
    email: string
    viber: string
    telegram: string
    whatsapp: string
    sms: string
  }
  products: {
    title: string
    countOne: string
    countFew: string
    countMany: string
    inCatalog: string
    exportCsv: string
    addProduct: string
    searchPlaceholder: string
    categoryPlaceholder: string
    allCategories: string
    statusPlaceholder: string
    allStatuses: string
    visible: string
    hidden: string
    inStock: string
    outOfStock: string
    popular: string
    sortPlaceholder: string
    sortNewest: string
    sortOldest: string
    priceAsc: string
    priceDesc: string
    byName: string
    selectedCount: string
    show: string
    hide: string
    toTrash: string
    colProduct: string
    colSku: string
    colCategories: string
    colPrice: string
    colViews: string
    colStock: string
    colStatus: string
    colActions: string
    notFound: string
    addFirst: string
    popularBadge: string
    noName: string
    edit: string
    duplicate: string
    pageLabel: string
    pageOf: string
    back: string
    next: string
    moveToTrashTitle: string
    moveToTrashDescSingle: string
    moveToTrashDescMany: string
    cancel: string
    toastShown: string
    toastHidden: string
    toastMovedToTrash: string
    toastCopied: string
    toastCopyError: string
    toastGenericError: string
    toastProductShown: string
    toastProductHidden: string
  }
  categories: {
    title: string
    countOne: string
    countFew: string
    countMany: string
    addCategory: string
    colName: string
    colSlug: string
    colParent: string
    colProducts: string
    colVisibility: string
    colActions: string
    none: string
    notFound: string
    showAria: string
    hideAria: string
    visible: string
    hidden: string
    editAria: string
    deleteAria: string
    editTitle: string
    newTitle: string
    dialogHint: string
    nameRu: string
    nameUk: string
    descriptionRu: string
    parentCategory: string
    noneRoot: string
    sortOrder: string
    showOnSite: string
    cancel: string
    save: string
    create: string
    deleteTitle: string
    deleteDescription: string
    deleteWithProducts: string
    delete: string
    toastFillBothLanguages: string
    toastUpdated: string
    toastCreated: string
    toastSaveError: string
    toastDeleted: string
    toastDeleteError: string
  }
}

const uk: AdminDictionary = {
  common: {
    save: 'Зберегти',
    cancel: 'Скасувати',
    delete: 'Видалити',
    edit: 'Редагувати',
    add: 'Додати',
    search: 'Пошук',
    filter: 'Фільтр',
    actions: 'Дії',
    yes: 'Так',
    no: 'Ні',
    loading: 'Завантаження...',
    confirm: 'Підтвердити',
    close: 'Закрити',
    back: 'Назад',
    language: 'Мова',
  },
  sidebar: {
    goToSite: 'Перейти на сайт',
    adminCenter: 'Адмін-центр',
    mainNav: 'Основна навігація',
    signOut: 'Вийти',
    signingOut: 'Вихід...',
  },
  navSections: {
    Обзор: 'Огляд',
    Продажи: 'Продажі',
    Каталог: 'Каталог',
    Маркетинг: 'Маркетинг',
    Контент: 'Контент',
    Логистика: 'Логістика',
    Система: 'Система',
  },
  navItems: {
    dashboard: 'Дашборд',
    statistics: 'Статистика',
    guides: 'Інструкції',
    orders: 'Замовлення',
    abandoned_carts: 'Покинуті кошики',
    customers: 'Клієнти',
    products: 'Товари',
    categories: 'Категорії',
    groups: 'Групи товарів',
    import: 'Імпорт',
    promotions: 'Акції',
    modal_ads: 'Модальна реклама',
    bestsellers: 'Топ продажів',
    pages: 'Сторінки',
    articles: 'Статті',
    reviews: 'Відгуки та питання',
    delivery: 'Доставка',
    payments: 'Платежі',
    users: 'Користувачі',
    logs: 'Логи',
    settings: 'Налаштування',
    trash: 'Кошик',
  },
  roles: {
    admin: 'Адміністратор',
    manager: 'Менеджер',
    content: 'Контент-менеджер',
  },
  orders: {
    listTitle: 'Замовлення',
    listSubtitle: 'Список замовлень',
    createOrder: 'Створити замовлення',
    searchPlaceholder: 'Пошук за номером, ім’ям, телефоном, email, накладною',
    statusPlaceholder: 'Статус',
    allStatuses: 'Всі статуси',
    notFoundTitle: 'Замовлень не знайдено',
    notFoundSubtitle: 'Змініть фільтри або створіть нове замовлення',
    back: 'Назад',
    next: 'Вперед',
    pageOf: 'з',
    statTotal: 'Всього замовлень',
    statNew: 'Нові',
    statActive: 'Активні',
    statRevenue: 'Виручка',
    backToOrdersAria: 'Назад до замовлень',
    orderNumber: 'Замовлення №',
    orderCompleted: 'Замовлення виконано',
    paidWith: 'Це замовлення оплачено',
    itemsInOrder: 'Товари в замовленні',
    sku: 'Артикул',
    units: 'шт.',
    customer: 'Покупець',
    payment: 'Оплата',
    paymentNotSelected: 'Спосіб не обрано',
    delivery: 'Доставка',
    method: 'Спосіб',
    address: 'Адреса',
    cost: 'Вартість',
    trackingLabel: 'Номер накладної (ЕН)',
    saveTracking: 'Зберегти ЕН',
    history: 'Історія замовлення',
    total: 'Всього',
    itemsCountLabel: 'товар(ів)',
    discount: 'Знижка',
    toPay: 'До сплати',
    actions: 'Дії',
    writeToCustomer: 'Написати покупцю',
    notes: 'Примітки',
    notePlaceholder: 'Розмір, колір тощо',
    save: 'Зберегти',
    tags: 'Мітки',
    newOrder: 'Нове замовлення',
    saveOrder: 'Зберегти замовлення',
    addItem: 'Додати товар',
    noItemsYet: 'Товари ще не додано',
    stockLabel: 'залишок',
    name: 'Ім’я',
    namePlaceholder: 'ПІБ покупця',
    phone: 'Телефон',
    phonePlaceholder: '+380...',
    emailLabel: 'Email',
    emailPlaceholder: 'email@example.com',
    notSelectedOption: 'Не обрано',
    city: 'Місто',
    branch: 'Відділення / адреса',
    tagsHint: 'Особисті нотатки для фільтрації замовлень',
    removeTagAria: 'Видалити мітку',
    newTagPlaceholder: 'Нова мітка',
    searchDialogPlaceholder: 'Назва або артикул (мін. 2 символи)',
    searching: 'Пошук...',
    nothingFound: 'Нічого не знайдено',
    toastStatusUpdated: 'Статус оновлено',
    toastPaymentUpdated: 'Оплату оновлено',
    toastTrackingSaved: 'Накладну збережено',
    toastNoteSaved: 'Примітку збережено',
    toastError: 'Помилка',
    toastSendError: 'Помилка надсилання',
    toastOpeningMessenger: 'Відкриваю месенджер',
    toastEmailSent: 'Лист надіслано покупцю',
    toastNetworkError: 'Помилка мережі',
    toastProductAdded: 'Товар додано',
    toastAddAtLeastOneItem: 'Додайте хоча б один товар',
    toastOrderCreated: 'Замовлення №{n} створено',
    toastCreateFailed: 'Не вдалося створити замовлення',
  },
  paymentMethods: {
    online: 'Онлайн-оплата',
    cod: 'Накладений платіж',
    prepay: 'Передоплата на картку',
    cash: 'Готівка',
  },
  deliveryMethods: {
    nova_poshta: 'Нова Пошта',
    ukrposhta: 'Укрпошта',
    courier: "Кур'єр",
    pickup: 'Самовивіз',
  },
  messengers: {
    email: 'Email',
    viber: 'Viber',
    telegram: 'Telegram',
    whatsapp: 'WhatsApp',
    sms: 'SMS',
  },
  products: {
    title: 'Товари',
    countOne: 'товар',
    countFew: 'товари',
    countMany: 'товарів',
    inCatalog: 'у каталозі',
    exportCsv: 'Експорт CSV',
    addProduct: 'Додати товар',
    searchPlaceholder: 'Пошук за назвою або артикулом…',
    categoryPlaceholder: 'Категорія',
    allCategories: 'Всі категорії',
    statusPlaceholder: 'Статус',
    allStatuses: 'Всі статуси',
    visible: 'Видимі',
    hidden: 'Приховані',
    inStock: 'В наявності',
    outOfStock: 'Немає в наявності',
    popular: 'Популярні',
    sortPlaceholder: 'Сортування',
    sortNewest: 'Спочатку нові',
    sortOldest: 'Спочатку старі',
    priceAsc: 'Ціна: за зростанням',
    priceDesc: 'Ціна: за спаданням',
    byName: 'За назвою',
    selectedCount: 'Обрано',
    show: 'Показати',
    hide: 'Приховати',
    toTrash: 'До кошика',
    colProduct: 'Товар',
    colSku: 'Артикул',
    colCategories: 'Категорії',
    colPrice: 'Ціна',
    colViews: 'Перегляди',
    colStock: 'Залишок',
    colStatus: 'Статус',
    colActions: 'Дії',
    notFound: 'Товари не знайдено',
    addFirst: 'Додати перший товар',
    popularBadge: 'Популярний',
    noName: 'Без назви',
    edit: 'Редагувати',
    duplicate: 'Дублювати',
    pageLabel: 'Сторінка',
    pageOf: 'з',
    back: 'Назад',
    next: 'Вперед',
    moveToTrashTitle: 'Перемістити в кошик?',
    moveToTrashDescSingle: 'Товар буде переміщено в кошик. Його можна буде відновити.',
    moveToTrashDescMany: 'товарів будуть переміщені в кошик. Їх можна буде відновити.',
    cancel: 'Скасувати',
    toastShown: 'Товари показано',
    toastHidden: 'Товари приховано',
    toastMovedToTrash: 'Переміщено в кошик',
    toastCopied: 'Товар скопійовано',
    toastCopyError: 'Помилка копіювання',
    toastGenericError: 'Сталася помилка',
    toastProductShown: 'Товар показано',
    toastProductHidden: 'Товар приховано',
  },
  categories: {
    title: 'Категорії',
    countOne: 'категорія',
    countFew: 'категорії',
    countMany: 'категорій',
    addCategory: 'Додати категорію',
    colName: 'Назва',
    colSlug: 'Slug',
    colParent: 'Батьківська',
    colProducts: 'Товарів',
    colVisibility: 'Видимість',
    colActions: 'Дії',
    none: 'Немає',
    notFound: 'Категорій поки немає',
    showAria: 'Показати категорію',
    hideAria: 'Приховати категорію',
    visible: 'Видима',
    hidden: 'Прихована',
    editAria: 'Редагувати',
    deleteAria: 'Видалити',
    editTitle: 'Редагувати категорію',
    newTitle: 'Нова категорія',
    dialogHint: 'Назва заповнюється двома мовами, slug створюється автоматично.',
    nameRu: 'Назва (RU) *',
    nameUk: 'Назва (UK) *',
    descriptionRu: 'Опис (RU)',
    parentCategory: 'Батьківська категорія',
    noneRoot: 'Немає (коренева)',
    sortOrder: 'Порядок сортування',
    showOnSite: 'Показувати на сайті',
    cancel: 'Скасувати',
    save: 'Зберегти',
    create: 'Створити',
    deleteTitle: 'Видалити категорію?',
    deleteDescription: 'буде видалена без можливості відновлення.',
    deleteWithProducts: 'Зв’язки з товарами також будуть видалені.',
    delete: 'Видалити',
    toastFillBothLanguages: 'Заповніть назву обома мовами',
    toastUpdated: 'Категорію оновлено',
    toastCreated: 'Категорію створено',
    toastSaveError: 'Помилка збереження',
    toastDeleted: 'Категорію видалено',
    toastDeleteError: 'Помилка видалення',
  },
}

const ru: AdminDictionary = {
  common: {
    save: 'Сохранить',
    cancel: 'Отменить',
    delete: 'Удалить',
    edit: 'Редактировать',
    add: 'Добавить',
    search: 'Поиск',
    filter: 'Фильтр',
    actions: 'Действия',
    yes: 'Да',
    no: 'Нет',
    loading: 'Загрузка...',
    confirm: 'Подтвердить',
    close: 'Закрыть',
    back: 'Назад',
    language: 'Язык',
  },
  sidebar: {
    goToSite: 'Перейти на сайт',
    adminCenter: 'Админ-центр',
    mainNav: 'Основная навигация',
    signOut: 'Выйти',
    signingOut: 'Выход...',
  },
  navSections: {
    Обзор: 'Обзор',
    Продажи: 'Продажи',
    Каталог: 'Каталог',
    Маркетинг: 'Маркетинг',
    Контент: 'Контент',
    Логистика: 'Логистика',
    Система: 'Система',
  },
  navItems: {
    dashboard: 'Дашборд',
    statistics: 'Статистика',
    guides: 'Инструкции',
    orders: 'Заказы',
    abandoned_carts: 'Брошенные корзины',
    customers: 'Клиенты',
    products: 'Товары',
    categories: 'Категории',
    groups: 'Группы товаров',
    import: 'Импорт',
    promotions: 'Акции',
    modal_ads: 'Модальная реклама',
    bestsellers: 'Топ продаж',
    pages: 'Страницы',
    articles: 'Статьи',
    reviews: 'Отзывы и вопросы',
    delivery: 'Доставка',
    payments: 'Платежи',
    users: 'Пользователи',
    logs: 'Логи',
    settings: 'Настройки',
    trash: 'Корзина',
  },
  roles: {
    admin: 'Администратор',
    manager: 'Менеджер',
    content: 'Контент-менеджер',
  },
  orders: {
    listTitle: 'Заказы',
    listSubtitle: 'Список заказов',
    createOrder: 'Создать заказ',
    searchPlaceholder: 'Поиск по номеру, имени, телефону, email, накладной',
    statusPlaceholder: 'Статус',
    allStatuses: 'Все статусы',
    notFoundTitle: 'Заказов не найдено',
    notFoundSubtitle: 'Измените фильтры или создайте новый заказ',
    back: 'Назад',
    next: 'Вперёд',
    pageOf: 'из',
    statTotal: 'Всего заказов',
    statNew: 'Новые',
    statActive: 'Активные',
    statRevenue: 'Выручка',
    backToOrdersAria: 'Назад к заказам',
    orderNumber: 'Заказ №',
    orderCompleted: 'Заказ выполнен',
    paidWith: 'Этот заказ оплачен',
    itemsInOrder: 'Товары в заказе',
    sku: 'Артикул',
    units: 'шт.',
    customer: 'Покупатель',
    payment: 'Оплата',
    paymentNotSelected: 'Способ не выбран',
    delivery: 'Доставка',
    method: 'Способ',
    address: 'Адрес',
    cost: 'Стоимость',
    trackingLabel: 'Номер накладной (ЕН)',
    saveTracking: 'Сохранить ЕН',
    history: 'История заказа',
    total: 'Всего',
    itemsCountLabel: 'товар(ов)',
    discount: 'Скидка',
    toPay: 'К оплате',
    actions: 'Действия',
    writeToCustomer: 'Написать покупателю',
    notes: 'Примечания',
    notePlaceholder: 'Размер, цвет и т.д.',
    save: 'Сохранить',
    tags: 'Метки',
    newOrder: 'Новый заказ',
    saveOrder: 'Сохранить заказ',
    addItem: 'Добавить товар',
    noItemsYet: 'Товары ещё не добавлены',
    stockLabel: 'остаток',
    name: 'Имя',
    namePlaceholder: 'ФИО покупателя',
    phone: 'Телефон',
    phonePlaceholder: '+380...',
    emailLabel: 'Email',
    emailPlaceholder: 'email@example.com',
    notSelectedOption: 'Не выбрано',
    city: 'Город',
    branch: 'Отделение / адрес',
    tagsHint: 'Личные заметки для фильтрации заказов',
    removeTagAria: 'Удалить метку',
    newTagPlaceholder: 'Новая метка',
    searchDialogPlaceholder: 'Название или артикул (мин. 2 символа)',
    searching: 'Поиск...',
    nothingFound: 'Ничего не найдено',
    toastStatusUpdated: 'Статус обновлён',
    toastPaymentUpdated: 'Оплата обновлена',
    toastTrackingSaved: 'Накладная сохранена',
    toastNoteSaved: 'Примечание сохранено',
    toastError: 'Ошибка',
    toastSendError: 'Ошибка отправки',
    toastOpeningMessenger: 'Открываю мессенджер',
    toastEmailSent: 'Письмо отправлено покупателю',
    toastNetworkError: 'Ошибка сети',
    toastProductAdded: 'Товар добавлен',
    toastAddAtLeastOneItem: 'Добавьте хотя бы один товар',
    toastOrderCreated: 'Заказ №{n} создан',
    toastCreateFailed: 'Не удалось создать заказ',
  },
  paymentMethods: {
    online: 'Онлайн-оплата',
    cod: 'Наложенный платёж',
    prepay: 'Предоплата на карту',
    cash: 'Наличные',
  },
  deliveryMethods: {
    nova_poshta: 'Нова Пошта',
    ukrposhta: 'Укрпошта',
    courier: 'Курьер',
    pickup: 'Самовывоз',
  },
  messengers: {
    email: 'Email',
    viber: 'Viber',
    telegram: 'Telegram',
    whatsapp: 'WhatsApp',
    sms: 'SMS',
  },
  products: {
    title: 'Товары',
    countOne: 'товар',
    countFew: 'товара',
    countMany: 'товаров',
    inCatalog: 'в каталоге',
    exportCsv: 'Экспорт CSV',
    addProduct: 'Добавить товар',
    searchPlaceholder: 'Поиск по названию или артикулу…',
    categoryPlaceholder: 'Категория',
    allCategories: 'Все категории',
    statusPlaceholder: 'Статус',
    allStatuses: 'Все статусы',
    visible: 'Видимые',
    hidden: 'Скрытые',
    inStock: 'В наличии',
    outOfStock: 'Нет в наличии',
    popular: 'Популярные',
    sortPlaceholder: 'Сортировка',
    sortNewest: 'Сначала новые',
    sortOldest: 'Сначала старые',
    priceAsc: 'Цена: по возрастанию',
    priceDesc: 'Цена: по убыванию',
    byName: 'По названию',
    selectedCount: 'Выбрано',
    show: 'Показать',
    hide: 'Скрыть',
    toTrash: 'В корзину',
    colProduct: 'Товар',
    colSku: 'Артикул',
    colCategories: 'Категории',
    colPrice: 'Цена',
    colViews: 'Просмотры',
    colStock: 'Остаток',
    colStatus: 'Статус',
    colActions: 'Действия',
    notFound: 'Товары не найдены',
    addFirst: 'Добавить первый товар',
    popularBadge: 'Популярный',
    noName: 'Без названия',
    edit: 'Редактировать',
    duplicate: 'Дублировать',
    pageLabel: 'Страница',
    pageOf: 'из',
    back: 'Назад',
    next: 'Вперёд',
    moveToTrashTitle: 'Переместить в корзину?',
    moveToTrashDescSingle: 'Товар будет перемещён в корзину. Его можно будет восстановить.',
    moveToTrashDescMany: 'товаров будут перемещены в корзину. Их можно будет восстановить.',
    cancel: 'Отмена',
    toastShown: 'Товары показаны',
    toastHidden: 'Товары скрыты',
    toastMovedToTrash: 'Перемещено в корзину',
    toastCopied: 'Товар скопирован',
    toastCopyError: 'Ошибка копирования',
    toastGenericError: 'Произошла ошибка',
    toastProductShown: 'Товар показан',
    toastProductHidden: 'Товар скрыт',
  },
  categories: {
    title: 'Категории',
    countOne: 'категория',
    countFew: 'категории',
    countMany: 'категорий',
    addCategory: 'Добавить категорию',
    colName: 'Название',
    colSlug: 'Slug',
    colParent: 'Родитель',
    colProducts: 'Товаров',
    colVisibility: 'Видимость',
    colActions: 'Действия',
    none: 'Нет',
    notFound: 'Категорий пока нет',
    showAria: 'Показать категорию',
    hideAria: 'Скрыть категорию',
    visible: 'Видима',
    hidden: 'Скрыта',
    editAria: 'Редактировать',
    deleteAria: 'Удалить',
    editTitle: 'Редактировать категорию',
    newTitle: 'Новая категория',
    dialogHint: 'Название заполняется на двух языках, slug создаётся автоматически.',
    nameRu: 'Название (RU) *',
    nameUk: 'Название (UK) *',
    descriptionRu: 'Описание (RU)',
    parentCategory: 'Родительская категория',
    noneRoot: 'Нет (корневая)',
    sortOrder: 'Порядок сортировки',
    showOnSite: 'Показывать на сайте',
    cancel: 'Отмена',
    save: 'Сохранить',
    create: 'Создать',
    deleteTitle: 'Удалить категорию?',
    deleteDescription: 'будет удалена без возможности восстановления.',
    deleteWithProducts: 'Связи с товарами также будут удалены.',
    delete: 'Удалить',
    toastFillBothLanguages: 'Заполните название на обоих языках',
    toastUpdated: 'Категория обновлена',
    toastCreated: 'Категория создана',
    toastSaveError: 'Ошибка сохранения',
    toastDeleted: 'Категория удалена',
    toastDeleteError: 'Ошибка удаления',
  },
}

const dictionaries: Record<Locale, AdminDictionary> = { uk, ru }

export function getAdminDictionary(locale: Locale): AdminDictionary {
  return dictionaries[locale]
}
