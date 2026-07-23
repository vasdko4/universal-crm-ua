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
  customers: {
    title: string
    countOne: string
    countFew: string
    countMany: string
    addCustomer: string
    searchPlaceholder: string
    reliabilityPlaceholder: string
    anyReliability: string
    reliabilityHigh: string
    reliabilityMedium: string
    find: string
    colCustomer: string
    colContacts: string
    colReliability: string
    colOrders: string
    colTurnover: string
    colLastOrder: string
    colActions: string
    notFound: string
    pageLabel: string
    removeTagAria: string
    actionsAria: string
    edit: string
    addTag: string
    delete: string
    pageOf: string
    back: string
    next: string
    addTagTitle: string
    tagPlaceholder: string
    cancel: string
    add: string
    deleteTitle: string
    deleteDescription: string
    toastArchived: string
    toastDeleteError: string
    toastTagAdded: string
    toastError: string
    contactViber: string
    contactSkype: string
    contactWhatsapp: string
    contactTelegram: string
    contactEmail: string
    contactPhone: string
    dialogEditTitle: string
    dialogNewTitle: string
    dialogHint: string
    firstName: string
    lastName: string
    firstNamePlaceholder: string
    lastNamePlaceholder: string
    mainPhone: string
    email: string
    reliabilityScore: string
    contactChannels: string
    addChannel: string
    noChannels: string
    channelValuePlaceholder: string
    removeChannelAria: string
    note: string
    notePlaceholder: string
    save: string
    saving: string
    create: string
    toastUpdated: string
    toastCreated: string
    toastSaveError: string
  }
  settings: {
    pageTitle: string
    pageSubtitle: string
    saveButton: string
    navGeneral: string
    navHomepage: string
    navSeo: string
    navDesign: string
    navBranding: string
    navContacts: string
    navWidget: string
    navSocial: string
    navEmail: string
    navNotifications: string
    navAds: string
    navGoogleAuth: string
    navSystem: string
    cacheTitle: string
    cacheDesc: string
    clearCacheLabel: string
    clearCacheHint: string
    clearCacheButton: string
    toastCacheCleared: string
    toastCacheClearError: string
    storeNameLabel: string
    storeDescLabel: string
    openCartTitle: string
    openCartDesc: string
    heroTitle: string
    heroDesc: string
    localeUk: string
    localeRu: string
    heroBadgeLabel: string
    heroBadgeHint: string
    heroTitleLabel: string
    heroTextLabel: string
    heroButtonLabel: string
    heroButtonHint: string
    heroImageLabel: string
    heroImageHint: string
    domainLabel: string
    domainHint: string
    metaTitleLabel: string
    onlineStoreSuffix: string
    charsCount: string
    metaDescLabel: string
    metaDescPlaceholder: string
    keywordsLabel: string
    keywordsPlaceholder: string
    keywordsHint: string
    gscHint: string
    gscPlaceholder: string
    indexingTitle: string
    indexingDesc: string
    templateTitle: string
    templateDesc: string
    premiumBadge: string
    defaultLangTitle: string
    defaultLangDesc: string
    imageReplace: string
    imageChooseFile: string
    imageDelete: string
    imageReplaceAria: string
    imageUploadAria: string
    imageUrlPlaceholder: string
    imageUploadError: string
    logoLabel: string
    logoHint: string
    faviconLabel: string
    faviconHint: string
    phonesTitle: string
    phonesDesc: string
    removePhoneAria: string
    addPhoneButton: string
    addressTitle: string
    addressOptional: string
    addressPlaceholder: string
    hoursTitle: string
    dayOff: string
    weekMon: string
    weekTue: string
    weekWed: string
    weekThu: string
    weekFri: string
    weekSat: string
    weekSun: string
    widgetTitle: string
    widgetDesc: string
    channelsLabel: string
    enableAllButton: string
    disableAllButton: string
    widgetFootnote: string
    channelPhoneLabel: string
    channelPhoneHint: string
    channelWhatsappLabel: string
    channelWhatsappHint: string
    channelTelegramLabel: string
    channelTelegramHint: string
    channelTelegramPlaceholder: string
    channelViberLabel: string
    channelViberHint: string
    channelEmailLabel: string
    channelEmailHint: string
    emailToggleTitle: string
    emailToggleDesc: string
    providerLabel: string
    fromNameLabel: string
    fromEmailLabel: string
    smtpHostLabel: string
    smtpPortLabel: string
    smtpUserLabel: string
    smtpPasswordLabel: string
    smtpTip: string
    dkimTitle: string
    dkimDesc: string
    dkimSelectorLabel: string
    dkimKeyLabel: string
    dnsBoxTitle: string
    dnsSpf: string
    dnsDkim: string
    dnsDmarc: string
    dnsImportant: string
    dnsImportantLabel: string
    notifSectionTitle: string
    notifSectionDesc: string
    customerEmailTitle: string
    customerEmailDesc: string
    adminEmailTitle: string
    adminEmailDesc: string
    adminEmailLabel: string
    adminEmailPlaceholder: string
    telegramTitle: string
    telegramDesc: string
    telegramTokenLabel: string
    telegramTokenHint: string
    telegramChatIdLabel: string
    telegramChatIdHint: string
    telegramChatIdPlaceholder: string
    testButton: string
    testNote: string
    toastTelegramSent: string
    toastTelegramError: string
    convTitle: string
    convDesc: string
    conversionIdLabel: string
    conversionLabelLabel: string
    gaTitle: string
    gaDesc: string
    gaMeasurementLabel: string
    gaHint: string
    merchantTitle: string
    merchantDesc: string
    merchantLocaleNote: string
    copyButton: string
    toastCopied: string
    googleAuthTitle: string
    googleAuthDescPrefix: string
    googleAuthDescLink: string
    googleAuthDescSuffix: string
    googleAuthToggleTitle: string
    googleAuthToggleConfigured: string
    googleAuthToggleNotConfigured: string
    clientIdLabel: string
    clientSecretLabel: string
    showSecretAria: string
    hideSecretAria: string
    secretHint: string
    redirectTitle: string
    redirectHint: string
    uploadErrorDefault: string
    toastSettingsSaved: string
    toastSettingsSaveError: string
  }
  updates: {
    title: string
    subtitle: string
    currentVersionLabel: string
    latestVersionLabel: string
    upToDate: string
    updateAvailable: string
    checkErrorTitle: string
    checkErrorDesc: string
    changelogLink: string
    recheckButton: string
    updateButton: string
    updatingButton: string
    updateStartedTitle: string
    updateStartedDesc: string
    updateErrorTitle: string
    updateErrorDesc: string
    updaterNotConfigured: string
  }
  delivery: {
    pageTitle: string
    pageSubtitle: string
    npDesc: string
    npApiKeyLabel: string
    npApiKeyPlaceholder: string
    npApiKeyHintReal: string
    npApiKeyHintDemo: string
    npCheckTitle: string
    ukrDesc: string
    ukrToggleLabel: string
    ukrToggleDesc: string
    toastUkrEnabled: string
    toastUkrDisabled: string
    badgeActive: string
    badgeRequired: string
    badgeDisabled: string
    searchDemoBadge: string
    searchStep1Label: string
    searchCityPlaceholder: string
    searchFindButton: string
    searchRegionSuffix: string
    searchStep2LabelPrefix: string
    searchTabBranch: string
    searchTabPostomat: string
    searchWhFilterPlaceholder: string
    searchLoading: string
    searchNothingFound: string
    searchMaxWeightPrefix: string
    searchMaxWeightSuffix: string
  }
  payments: {
    pageTitle: string
    pageSubtitle: string
    tabProcessing: string
    tabMethods: string
    tabGateways: string
    statusCreated: string
    statusPending: string
    statusPaid: string
    statusPartiallyRefunded: string
    statusRefunded: string
    statusFailed: string
    statusExpired: string
    statTotal: string
    statPaid: string
    statRefunded: string
    statPending: string
    createButton: string
    colOrder: string
    colGateway: string
    colAmount: string
    colStatus: string
    colCustomer: string
    colDate: string
    colActions: string
    emptyPayments: string
    refundedPrefix: string
    openPayment: string
    refreshStatus: string
    markPaid: string
    refundAction: string
    newPaymentTitle: string
    newPaymentDesc: string
    noActiveGateways: string
    gatewayLabel: string
    gatewaySelectPlaceholder: string
    currencyLabel: string
    amountLabel: string
    descLabel: string
    descPlaceholder: string
    customerLabel: string
    phoneLabel: string
    emailLabel: string
    createInvoiceButton: string
    refundDialogTitle: string
    refundDialogDescPrefix: string
    refundDialogAlreadyRefunded: string
    refundAmountLabel: string
    refundHintPrefix: string
    refundHintSuffix: string
    confirmRefundButton: string
    toastSelectGateway: string
    toastInvalidAmount: string
    toastRefundAmount: string
    wfpMerchantLoginHint: string
    wfpSecretKeyHint: string
    wfpDomainHint: string
    wfpPasswordHint: string
    monobankTokenLabel: string
    monobankTokenHint: string
    optionalLabel: string
    copiedToast: string
    copyFailedToast: string
    copyAria: string
    serviceUrlLabel: string
    approvedUrlLabel: string
    webhookUrlLabel: string
    redirectUrlLabel: string
    urlsSectionTitlePrefix: string
    urlsHintPrefix: string
    urlsHintWfpSuffix: string
    urlsHintMonoSuffix: string
    urlsHintEnd: string
    wfpDesc: string
    monoDesc: string
    badgeActiveGateway: string
    badgeDisabledGateway: string
    badgeTestMode: string
    toastFillFields: string
    activeSwitchLabel: string
    activeSwitchDesc: string
    testSwitchLabel: string
    testSwitchDesc: string
    statusEnabled: string
    statusDisabledMethod: string
    availableAtCheckoutLabel: string
    customerCanChooseDesc: string
    codHint: string
    onlineHint: string
    activeGatewaysPrefix: string
    noActiveGatewaysHint: string
    requisitesDesc: string
    requisitesTypeLabel: string
    tabCard: string
    tabRequisites: string
    cardNumberLabel: string
    cardHolderLabel: string
    edrpouLabel: string
    recipientNameLabel: string
    ibanLabel: string
    toastCardFieldsRequired: string
    toastRequisitesFieldsRequired: string
    toastMethodEnabledSuffix: string
    toastMethodDisabledSuffix: string
  }
  promotions: {
    tabAll: string
    tabActive: string
    tabInactive: string
    searchPlaceholder: string
    emptyTitle: string
    emptyDesc: string
    addButton: string
    pageTitle: string
    pageSubtitle: string
    noResults: string
    deleteDialogTitle: string
    deleteDialogDesc: string
    toastActivated: string
    toastDeactivated: string
    toastDeleted: string
    toastCodeCopied: string
    targetAll: string
    targetGroups: string
    targetProducts: string
    noEndDate: string
    usedLabel: string
    totalDiscountLabel: string
    statusSr: string
    actionsAria: string
    copyCodeAction: string
    formSubtitle: string
    backAria: string
    formTitleNew: string
    saveButtonSaving: string
    saveButtonDefault: string
    sectionMainInfo: string
    typePromoTitle: string
    typePromoDesc: string
    typeDiscountTitle: string
    typeDiscountDesc: string
    nameLabel: string
    namePlaceholder: string
    discountTypeLabel: string
    discountTypePercent: string
    discountTypeFixed: string
    discountValueLabel: string
    promoCodeLabel: string
    generateButton: string
    sectionScope: string
    scopeAllTitle: string
    scopeAllDesc: string
    scopeGroupsTitle: string
    scopeGroupsDesc: string
    scopeProductsTitle: string
    scopeProductsDesc: string
    noGroups: string
    noProducts: string
    sectionLimits: string
    limitUsageTitle: string
    limitUsagePlaceholder: string
    limitMinOrderTitle: string
    limitMinOrderPlaceholder: string
    noStackingTitle: string
    excludeWholesaleTitle: string
    sectionDates: string
    startDateLabel: string
    endDateLabel: string
    setEndDateLabel: string
    sectionSummary: string
    summaryTypeLabel: string
    summaryTypePromo: string
    summaryTypeDiscount: string
    summaryNameLabel: string
    summaryDiscountLabel: string
    summaryPromoCodeLabel: string
    summaryScopeLabel: string
    summaryGroupsPrefix: string
    summaryProductsPrefix: string
    summaryLimitsLabel: string
    summaryLimitUsagePrefix: string
    summaryLimitMinOrderPrefix: string
    summaryNoStacking: string
    summaryExcludeWholesale: string
    summaryNone: string
    summaryDatesLabel: string
    summaryFromNoEnd: string
    sectionUsageStats: string
    statAppliedCount: string
    statOrdersTotal: string
    statDiscountTotal: string
    statsHint: string
    toastCreated: string
    toastCreateError: string
  }
  statistics: {
    days7: string
    days30: string
    days90: string
    statusNew: string
    statusProcessing: string
    statusShipped: string
    statusDone: string
    statusCancelled: string
    statusPendingPayment: string
    methodNovaPoshta: string
    methodUkrposhta: string
    methodPickup: string
    methodCourier: string
    methodCod: string
    methodCard: string
    methodCash: string
    methodBankTransfer: string
    methodRequisites: string
    weekdayMon: string
    weekdayTue: string
    weekdayWed: string
    weekdayThu: string
    weekdayFri: string
    weekdaySat: string
    weekdaySun: string
    pageTitle: string
    pageSubtitle: string
    cardVisitors: string
    cardPageViews: string
    cardProductViews: string
    cardAddToCart: string
    cardOrders: string
    cardRevenuePeriod: string
    cardCost: string
    cardNetProfit: string
    marginLabel: string
    cardAvgCheck: string
    avgItemsPerOrderPrefix: string
    avgItemsPerOrderSuffix: string
    cardAbandonedCarts: string
    potentialPrefix: string
    chartRevenueProfitTitle: string
    seriesRevenue: string
    seriesProfit: string
    seriesOrders: string
    funnelTitle: string
    funnelVisitors: string
    funnelProductViews: string
    funnelAddToCart: string
    funnelOrders: string
    conversionOverallPrefix: string
    conversionCartPrefix: string
    orderStatusesTitle: string
    noOrdersPeriod: string
    topProductsTitle: string
    unitsSoldSuffix: string
    profitSuffix: string
    noSalesPeriod: string
    categorySalesTitle: string
    noDataPeriod: string
    weekdayOrdersTitle: string
    customersTitle: string
    uniqueLabel: string
    newLabel: string
    returningLabel: string
    topCustomersTitle: string
    ordersShortSuffix: string
    noData: string
    deliveryMethodsTitle: string
    paymentMethodsTitle: string
    trafficDynamicsTitle: string
    seriesViews: string
    seriesVisitors: string
    topPagesTitle: string
    trafficSourcesTitle: string
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
    system_updates: 'Оновлення',
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
  customers: {
    title: 'Клієнти',
    countOne: 'запис',
    countFew: 'записи',
    countMany: 'записів',
    addCustomer: 'Додати клієнта',
    searchPlaceholder: 'Пошук за ім’ям, телефоном або email...',
    reliabilityPlaceholder: 'Надійність',
    anyReliability: 'Будь-яка надійність',
    reliabilityHigh: 'Висока (80+)',
    reliabilityMedium: 'Середня (50+)',
    find: 'Знайти',
    colCustomer: 'Клієнт',
    colContacts: 'Контакти',
    colReliability: 'Надійність',
    colOrders: 'Замовлення',
    colTurnover: 'Оборот',
    colLastOrder: 'Останнє замовлення',
    colActions: 'Дії',
    notFound: 'Клієнтів не знайдено',
    pageLabel: 'Сторінка',
    removeTagAria: 'Видалити тег',
    actionsAria: 'Дії',
    edit: 'Редагувати',
    addTag: 'Додати тег',
    delete: 'Видалити',
    pageOf: 'з',
    back: 'Назад',
    next: 'Вперед',
    addTagTitle: 'Додати тег',
    tagPlaceholder: 'Наприклад: VIP, Опт, Постійний',
    cancel: 'Скасувати',
    add: 'Додати',
    deleteTitle: 'Видалити клієнта?',
    deleteDescription: 'буде переміщений в архів (м’яке видалення). Дані збережуться в базі.',
    toastArchived: 'Клієнта переміщено в архів',
    toastDeleteError: 'Не вдалося видалити клієнта',
    toastTagAdded: 'Тег додано',
    toastError: 'Помилка',
    contactViber: 'Viber',
    contactSkype: 'Skype',
    contactWhatsapp: 'WhatsApp',
    contactTelegram: 'Telegram',
    contactEmail: 'Дод. email',
    contactPhone: 'Дод. телефон',
    dialogEditTitle: 'Редагування клієнта',
    dialogNewTitle: 'Новий клієнт',
    dialogHint: 'Основна інформація та додаткові канали зв’язку.',
    firstName: 'Ім’я *',
    lastName: 'Прізвище',
    firstNamePlaceholder: 'Олександр',
    lastNamePlaceholder: 'Коваленко',
    mainPhone: 'Основний телефон *',
    email: 'Email',
    reliabilityScore: 'Оцінка надійності (0–100)',
    contactChannels: 'Канали зв’язку',
    addChannel: 'Додати канал зв’язку',
    noChannels: 'Немає додаткових каналів зв’язку',
    channelValuePlaceholder: 'Значення',
    removeChannelAria: 'Видалити канал',
    note: 'Примітка',
    notePlaceholder: 'Коментар про клієнта...',
    save: 'Зберегти',
    saving: 'Збереження...',
    create: 'Створити клієнта',
    toastUpdated: 'Клієнта оновлено',
    toastCreated: 'Клієнта створено',
    toastSaveError: 'Помилка збереження',
  },
  settings: {
    pageTitle: 'Налаштування',
    pageSubtitle: 'Конфігурація магазину та інтеграцій',
    saveButton: 'Зберегти',
    navGeneral: 'Основне',
    navHomepage: 'Головна сторінка',
    navSeo: 'SEO',
    navDesign: 'Дизайн',
    navBranding: 'Логотип',
    navContacts: 'Контакти',
    navWidget: 'Кнопка звʼязку',
    navSocial: 'Соцмережі',
    navEmail: 'Email',
    navNotifications: 'Сповіщення',
    navAds: 'Google Ads / Analytics',
    navGoogleAuth: 'Вхід через Google',
    navSystem: 'Система',
    cacheTitle: 'Кеш сайту',
    cacheDesc:
      'Вітрина кешує каталог, сторінки товарів, налаштування та відгуки, щоб працювати швидко. Якщо після змін (імпорт товарів, правки напряму в базі) на сайті видно старі дані — очистіть кеш вручну.',
    clearCacheLabel: 'Очистити кеш',
    clearCacheHint: 'Скидає кеш каталогу, товарів, категорій, відгуків і налаштувань',
    clearCacheButton: 'Очистити кеш',
    toastCacheCleared: 'Кеш очищено — вітрина оновиться під час наступного відкриття сторінок',
    toastCacheClearError: 'Не вдалося очистити кеш',
    storeNameLabel: 'Назва магазину',
    storeDescLabel: 'Опис',
    openCartTitle: 'Відкривати кошик після додавання',
    openCartDesc: 'Автоматично показувати кошик при додаванні товару',
    heroTitle: 'Hero-блок головної сторінки',
    heroDesc:
      'Великий банер угорі головної сторінки: бейдж, заголовок, опис, кнопка та картинка. Порожні поля показують стандартний текст. Тексти задаються окремо для кожної мови.',
    localeUk: 'Українська',
    localeRu: 'Русский',
    heroBadgeLabel: 'Бейдж',
    heroBadgeHint: 'Маленький напис над заголовком.',
    heroTitleLabel: 'Заголовок',
    heroTextLabel: 'Опис',
    heroButtonLabel: 'Текст кнопки',
    heroButtonHint: 'Кнопка завжди веде до каталогу.',
    heroImageLabel: 'Картинка hero-блоку',
    heroImageHint:
      'Завантажте зображення з пристрою або вставте посилання. Порожньо — стандартна картинка. Спільна для обох мов, рекомендоване співвідношення 4:3.',
    domainLabel: 'Домен магазину',
    domainHint:
      'Канонічна адреса сайту. Використовується в sitemap.xml, robots.txt, канонічних посиланнях та Open Graph. Якщо порожньо — визначається автоматично за хостингом.',
    metaTitleLabel: 'Meta title',
    onlineStoreSuffix: '— інтернет-магазин',
    charsCount: 'символів',
    metaDescLabel: 'Meta description',
    metaDescPlaceholder: 'Опис магазину для результатів пошуку Google',
    keywordsLabel: 'Ключові слова',
    keywordsPlaceholder: 'електроніка, смартфони, навушники',
    keywordsHint: 'Через кому.',
    gscHint: 'Значення content із meta-тегу підтвердження власності сайту.',
    gscPlaceholder: 'Код підтвердження (google-site-verification)',
    indexingTitle: 'Індексація в пошукових системах',
    indexingDesc: 'Вимкніть, щоб приховати сайт від Google (noindex) до запуску',
    templateTitle: 'Шаблон вітрини',
    templateDesc: 'Виберіть оформлення магазину. Зміни застосовуються до всієї вітрини після збереження.',
    premiumBadge: 'Преміум',
    defaultLangTitle: 'Мова за замовчуванням',
    defaultLangDesc: 'Мова, яка пропонується новим відвідувачам під час першого входу.',
    imageReplace: 'Замінити',
    imageChooseFile: 'Обрати файл',
    imageDelete: 'Видалити',
    imageReplaceAria: 'Замінити',
    imageUploadAria: 'Завантажити',
    imageUrlPlaceholder: 'або вставте посилання https://...',
    imageUploadError: 'Помилка завантаження',
    logoLabel: 'Логотип',
    logoHint:
      'Завантажте зображення з пристрою або вставте посилання. Відображається в шапці адмін-центру та магазину.',
    faviconLabel: 'Favicon',
    faviconHint: 'Іконка сайту (32×32). Завантажте файл або вставте посилання.',
    phonesTitle: 'Телефони',
    phonesDesc: 'Можна додати до 3 номерів. Відображаються у футері магазину.',
    removePhoneAria: 'Видалити номер',
    addPhoneButton: 'Додати номер',
    addressTitle: 'Адреса магазину',
    addressOptional: '(необовʼязково)',
    addressPlaceholder: 'м. Київ, вул. Хрещатик, 1',
    hoursTitle: 'Час роботи',
    dayOff: 'Вихідний',
    weekMon: 'Понеділок',
    weekTue: 'Вівторок',
    weekWed: 'Середа',
    weekThu: 'Четвер',
    weekFri: "П'ятниця",
    weekSat: 'Субота',
    weekSun: 'Неділя',
    widgetTitle: 'Плаваюча кнопка звʼязку',
    widgetDesc: 'Кнопка у правому нижньому куті магазину зі швидкими контактами',
    channelsLabel: 'Канали:',
    enableAllButton: 'Увімкнути всі',
    disableAllButton: 'Вимкнути всі',
    widgetFootnote:
      'Кнопка з’являється на вітрині лише якщо увімкнено загальний перемикач і є хоча б один активний канал із заповненим значенням.',
    channelPhoneLabel: 'Телефон',
    channelPhoneHint: 'Дзвінок відкриється в застосунку телефону',
    channelWhatsappLabel: 'WhatsApp',
    channelWhatsappHint: 'Номер у міжнародному форматі',
    channelTelegramLabel: 'Telegram',
    channelTelegramHint: 'Ім’я користувача або повне посилання t.me',
    channelTelegramPlaceholder: '@username або посилання',
    channelViberLabel: 'Viber',
    channelViberHint: 'Номер телефону Viber',
    channelEmailLabel: 'Email',
    channelEmailHint: 'Відкриється поштовий клієнт',
    emailToggleTitle: 'Email-сповіщення',
    emailToggleDesc: 'Надсилати листи клієнтам про замовлення',
    providerLabel: 'Провайдер',
    fromNameLabel: "Ім'я відправника",
    fromEmailLabel: 'Email відправника',
    smtpHostLabel: 'SMTP хост',
    smtpPortLabel: 'SMTP порт',
    smtpUserLabel: 'SMTP логін',
    smtpPasswordLabel: 'SMTP пароль',
    smtpTip:
      'Порада: для безпеки зберігайте пароль SMTP у змінній середовища SMTP_PASSWORD. Тоді листи надсилатимуться автоматично.',
    dkimTitle: 'DKIM-підпис (антиспам)',
    dkimDesc:
      'Потрібно лише якщо ваш SMTP-сервер сам не підписує листи. Gmail і SendGrid підписують автоматично — залиште поля порожніми.',
    dkimSelectorLabel: 'DKIM селектор',
    dkimKeyLabel: 'DKIM приватний ключ (PEM)',
    dnsBoxTitle: 'Щоб листи не потрапляли у спам — налаштуйте DNS домену відправника:',
    dnsSpf: 'TXT-запис: v=spf1 include:_spf.google.com ~all (для Gmail; для іншого SMTP — include вашого провайдера)',
    dnsDkim:
      'увімкніть підпис у провайдера (Gmail: Admin console → Apps → Google Workspace → Gmail → Authenticate email) і додайте видану TXT-запис',
    dnsDmarc: 'TXT-запис _dmarc.ваш-домен: v=DMARC1; p=quarantine; rua=mailto:admin@ваш-домен',
    dnsImportant:
      '«Email відправника» має збігатися з SMTP-логіном, інакше лист піде від імені логіна (інше значення стане адресою для відповідей)',
    dnsImportantLabel: 'Важливо',
    notifSectionTitle: 'Сповіщення про нові замовлення',
    notifSectionDesc:
      'Кому і як повідомляти, коли покупець оформив замовлення. Для листів має бути налаштована вкладка Email (SMTP).',
    customerEmailTitle: 'Лист покупцю',
    customerEmailDesc: 'Підтвердження замовлення на email покупця (якщо він його вказав)',
    adminEmailTitle: 'Лист адміністратору',
    adminEmailDesc: 'Сповіщення про кожне нове замовлення',
    adminEmailLabel: 'Email адміністратора',
    adminEmailPlaceholder: 'Порожньо = адреса з налаштувань SMTP',
    telegramTitle: 'Telegram адміністратору',
    telegramDesc: 'Миттєве повідомлення про замовлення в особисті або групу',
    telegramTokenLabel: 'Токен бота',
    telegramTokenHint: 'Створіть бота в @BotFather у Telegram і вставте сюди його токен',
    telegramChatIdLabel: 'Chat ID',
    telegramChatIdHint:
      'Напишіть боту /start, потім дізнайтесь свій ID у @userinfobot. Для групи додайте бота до групи.',
    telegramChatIdPlaceholder: '123456789 або -100123456789 (група)',
    testButton: 'Надіслати тест',
    testNote: 'Перед тестом збережіть налаштування або заповніть поля вище — тест використовує введені значення.',
    toastTelegramSent: 'Тестове повідомлення надіслано в Telegram',
    toastTelegramError: 'Помилка надсилання',
    convTitle: 'Відстеження конверсій',
    convDesc: 'Google Ads conversion tracking',
    conversionIdLabel: 'Conversion ID',
    conversionLabelLabel: 'Conversion Label',
    gaTitle: 'Google Analytics (GA4)',
    gaDesc: 'Перегляди сторінок, товарів, додавання в кошик, покупки — воронка продажів прямо в GA4',
    gaMeasurementLabel: 'Measurement ID',
    gaHint: 'Знайдіть у Google Analytics: Адміністратор → Потоки даних → ваш веб-потік.',
    merchantTitle: 'Google Merchant Center',
    merchantDesc:
      'Товарний фід для Google Shopping/Merchant Center. Додайте це посилання в Merchant Center (Продукти → Фіди → «Заданий час отримання»), воно оновлюється автоматично:',
    merchantLocaleNote: 'Для окремого фіда російською додайте ?locale=ru до посилання.',
    copyButton: 'Копіювати',
    toastCopied: 'Скопійовано',
    googleAuthTitle: 'Вхід через Google (OAuth 2.0)',
    googleAuthDescPrefix: 'Ключі створюються в',
    googleAuthDescLink: 'Google Cloud Console',
    googleAuthDescSuffix:
      '(APIs & Services → Credentials → OAuth client ID, тип «Web application»). Зберігаються в базі даних магазину і застосовуються без перезапуску сервера.',
    googleAuthToggleTitle: 'Кнопка «Увійти через Google»',
    googleAuthToggleConfigured: 'Показувати кнопку у вікні входу та реєстрації',
    googleAuthToggleNotConfigured: 'Заповніть Client ID і Client Secret, щоб увімкнути',
    clientIdLabel: 'Client ID',
    clientSecretLabel: 'Client Secret',
    showSecretAria: 'Показати секрет',
    hideSecretAria: 'Приховати секрет',
    secretHint: 'Секрет зберігається в базі даних. Не передавайте його третім особам.',
    redirectTitle: 'Redirect URI для Google Console',
    redirectHint: 'Додайте цю адресу до «Authorized redirect URIs» вашого OAuth-клієнта.',
    uploadErrorDefault: 'Помилка завантаження',
    toastSettingsSaved: 'Налаштування збережено',
    toastSettingsSaveError: 'Помилка збереження',
  },
  updates: {
    title: 'Оновлення',
    subtitle: 'Поточна версія системи та перевірка нових релізів',
    currentVersionLabel: 'Поточна версія',
    latestVersionLabel: 'Остання версія',
    upToDate: 'Встановлена остання версія',
    updateAvailable: 'Доступне оновлення',
    checkErrorTitle: 'Не вдалося перевірити оновлення',
    checkErrorDesc: 'Перевірте підключення до інтернету та спробуйте ще раз.',
    changelogLink: 'Що нового',
    recheckButton: 'Перевірити ще раз',
    updateButton: 'Оновити',
    updatingButton: 'Оновлення…',
    updateStartedTitle: 'Оновлення запущено',
    updateStartedDesc:
      'Система завантажує нову версію та перезапуститься автоматично — це займе близько хвилини. Сторінка стане недоступна на короткий час.',
    updateErrorTitle: 'Не вдалося запустити оновлення',
    updateErrorDesc: 'Спробуйте ще раз або оновіть вручну на сервері.',
    updaterNotConfigured: 'Автооновлення не налаштоване на цьому сервері. Зверніться до Viktor або оновіть вручну.',
  },
  delivery: {
    pageTitle: 'Методи доставки',
    pageSubtitle: 'Налаштування служб доставки для інтернет-магазину',
    npDesc: 'Пошук відділень і поштоматів через API',
    npApiKeyLabel: 'API-ключ Нова Пошта',
    npApiKeyPlaceholder: 'Введіть ключ з особистого кабінету',
    npApiKeyHintReal: 'Пошук виконується через реальний API Нова Пошта.',
    npApiKeyHintDemo: 'Без ключа доступний демо-режим із прикладами відділень.',
    npCheckTitle: 'Перевірка отримання: відділення і поштомати',
    ukrDesc: 'Доставка поштовими відділеннями Укрпошти',
    ukrToggleLabel: 'Доставка Укрпоштою',
    ukrToggleDesc: 'Клієнти зможуть обрати доставку Укрпоштою під час оформлення',
    toastUkrEnabled: 'Укрпошту увімкнено',
    toastUkrDisabled: 'Укрпошту вимкнено',
    badgeActive: 'Активна',
    badgeRequired: 'Обов\'язкова',
    badgeDisabled: 'Вимкнена',
    searchDemoBadge: 'Демо-режим (вкажіть API-ключ для реальних даних)',
    searchStep1Label: '1. Місто отримання',
    searchCityPlaceholder: 'Почніть вводити місто, наприклад Київ',
    searchFindButton: 'Знайти',
    searchRegionSuffix: 'обл.',
    searchStep2LabelPrefix: '2. Пункт видачі в місті',
    searchTabBranch: 'Відділення',
    searchTabPostomat: 'Поштомати',
    searchWhFilterPlaceholder: 'Фільтр за номером або адресою',
    searchLoading: 'Завантаження...',
    searchNothingFound: 'Нічого не знайдено',
    searchMaxWeightPrefix: 'до',
    searchMaxWeightSuffix: 'кг',
  },
  payments: {
    pageTitle: 'Платежі',
    pageSubtitle: 'Приймання оплат і повернення коштів через WayForPay і Monobank',
    tabProcessing: 'Обробка',
    tabMethods: 'Способи оплати',
    tabGateways: 'Шлюзи',
    statusCreated: 'Створено',
    statusPending: 'Очікує оплати',
    statusPaid: 'Оплачено',
    statusPartiallyRefunded: 'Часткове повернення',
    statusRefunded: 'Повернуто',
    statusFailed: 'Помилка',
    statusExpired: 'Прострочено',
    statTotal: 'Усього платежів',
    statPaid: 'Оплачено',
    statRefunded: 'Повернуто',
    statPending: 'В очікуванні',
    createButton: 'Створити платіж',
    colOrder: 'Замовлення',
    colGateway: 'Шлюз',
    colAmount: 'Сума',
    colStatus: 'Статус',
    colCustomer: 'Клієнт',
    colDate: 'Дата',
    colActions: 'Дії',
    emptyPayments: 'Платежів поки немає',
    refundedPrefix: 'повернення',
    openPayment: 'Відкрити оплату',
    refreshStatus: 'Оновити статус',
    markPaid: 'Позначити оплаченим',
    refundAction: 'Повернення коштів',
    newPaymentTitle: 'Новий платіж',
    newPaymentDesc: 'Створюється рахунок у вибраному шлюзі та формується посилання на оплату.',
    noActiveGateways: 'Немає активних шлюзів. Активуйте WayForPay або Monobank на вкладці «Шлюзи».',
    gatewayLabel: 'Шлюз *',
    gatewaySelectPlaceholder: 'Виберіть шлюз',
    currencyLabel: 'Валюта',
    amountLabel: 'Сума *',
    descLabel: 'Призначення платежу',
    descPlaceholder: 'Оплата замовлення №...',
    customerLabel: 'Клієнт',
    phoneLabel: 'Телефон',
    emailLabel: 'Email',
    createInvoiceButton: 'Створити рахунок',
    refundDialogTitle: 'Повернення коштів',
    refundDialogDescPrefix: 'Платіж',
    refundDialogAlreadyRefunded: 'Уже повернуто',
    refundAmountLabel: 'Сума повернення',
    refundHintPrefix: 'Повернення виконується через API',
    refundHintSuffix: 'Можливе часткове повернення.',
    confirmRefundButton: 'Повернути кошти',
    toastSelectGateway: 'Виберіть платіжний шлюз',
    toastInvalidAmount: 'Вкажіть коректну суму',
    toastRefundAmount: 'Вкажіть суму повернення',
    wfpMerchantLoginHint: 'Логін мерчанта з особистого кабінету WayForPay (напр. test_skycrms_pp_ua)',
    wfpSecretKeyHint: 'Секретний ключ для підпису запитів (HMAC-MD5)',
    wfpDomainHint: 'Домен сайту, наприклад shop.example.com',
    wfpPasswordHint: 'Необов\'язково. Пароль мерчанта з кабінету — для операцій, де він потрібен. У підписі платіжного API не використовується.',
    monobankTokenLabel: 'Токен еквайрингу (X-Token)',
    monobankTokenHint: 'Токен з кабінету Monobank Acquiring',
    optionalLabel: '(необов\'язково)',
    copiedToast: 'Скопійовано',
    copyFailedToast: 'Не вдалося скопіювати',
    copyAria: 'Скопіювати',
    serviceUrlLabel: 'Service URL (сповіщення про платежі)',
    approvedUrlLabel: 'approvedUrl / declinedUrl (повернення клієнта)',
    webhookUrlLabel: 'Webhook URL (сповіщення про платежі)',
    redirectUrlLabel: 'Redirect URL (повернення клієнта)',
    urlsSectionTitlePrefix: 'Посилання для особистого кабінету',
    urlsHintPrefix: 'Заповнювати необов\'язково: магазин передає ці адреси автоматично з кожним платежем. Вкажіть їх у кабінеті',
    urlsHintWfpSuffix: 'WayForPay (розділ «Сповіщення»)',
    urlsHintMonoSuffix: 'Monobank',
    urlsHintEnd: 'як запасний варіант.',
    wfpDesc: 'Оплата карткою, Apple Pay, Google Pay',
    monoDesc: 'Еквайринг Monobank для бізнесу',
    badgeActiveGateway: 'Активний',
    badgeDisabledGateway: 'Вимкнений',
    badgeTestMode: 'Тест',
    toastFillFields: 'Заповніть усі поля перед активацією шлюзу',
    activeSwitchLabel: 'Активний',
    activeSwitchDesc: 'Доступний для приймання оплат',
    testSwitchLabel: 'Тестовий режим',
    testSwitchDesc: 'Дозволити ручну позначку оплати',
    statusEnabled: 'Увімкнено',
    statusDisabledMethod: 'Вимкнено',
    availableAtCheckoutLabel: 'Доступний під час оформлення',
    customerCanChooseDesc: 'Клієнт зможе обрати цей спосіб',
    codHint: 'Оплата під час отримання товару',
    onlineHint: 'Оплата через підключені платіжні шлюзи',
    activeGatewaysPrefix: 'Активні шлюзи:',
    noActiveGatewaysHint: 'Немає активних шлюзів — увімкніть їх на вкладці «Шлюзи».',
    requisitesDesc: 'Оплата на картку або за банківськими реквізитами',
    requisitesTypeLabel: 'Тип реквізитів',
    tabCard: 'Оплата на картку',
    tabRequisites: 'За реквізитами',
    cardNumberLabel: 'Номер картки',
    cardHolderLabel: 'ПІБ отримувача',
    edrpouLabel: 'ЄДРПОУ або РНОКПП',
    recipientNameLabel: 'Назва отримувача',
    ibanLabel: 'Рахунок IBAN',
    toastCardFieldsRequired: 'Вкажіть номер картки і ПІБ отримувача',
    toastRequisitesFieldsRequired: 'Заповніть ЄДРПОУ/РНОКПП, отримувача та IBAN',
    toastMethodEnabledSuffix: 'увімкнено',
    toastMethodDisabledSuffix: 'вимкнено',
  },
  promotions: {
    tabAll: 'Усі',
    tabActive: 'Активні',
    tabInactive: 'Неактивні',
    searchPlaceholder: 'Пошук за назвою…',
    emptyTitle: 'Тут поки що нічого немає',
    emptyDesc: 'Створіть першу акцію або промокод, щоб залучати покупців та збільшувати продажі.',
    addButton: 'Додати акцію',
    pageTitle: 'Акції та промокоди',
    pageSubtitle: 'Керування знижками, промокодами та таргетингом',
    noResults: 'За вашим запитом нічого не знайдено.',
    deleteDialogTitle: 'Видалити акцію?',
    deleteDialogDesc: 'Дію не можна скасувати. Статистику використання також буде видалено.',
    toastActivated: 'Акцію активовано',
    toastDeactivated: 'Акцію вимкнено',
    toastDeleted: 'Акцію видалено',
    toastCodeCopied: 'Промокод скопійовано',
    targetAll: 'Усі товари',
    targetGroups: 'Обрані групи',
    targetProducts: 'Конкретні позиції',
    noEndDate: 'безстроково',
    usedLabel: 'Використано',
    totalDiscountLabel: 'Сума знижок',
    statusSr: 'Статус акції',
    actionsAria: 'Дії',
    copyCodeAction: 'Копіювати код',
    formSubtitle: 'Налаштуйте знижку, таргетинг та обмеження',
    backAria: 'Назад',
    formTitleNew: 'Нова акція',
    saveButtonSaving: 'Збереження…',
    saveButtonDefault: 'Зберегти акцію',
    sectionMainInfo: 'Основна інформація',
    typePromoTitle: 'Промокод',
    typePromoDesc: 'Код для покупця',
    typeDiscountTitle: 'Знижка',
    typeDiscountDesc: 'Автоматична',
    nameLabel: 'Назва акції',
    namePlaceholder: 'Наприклад, Весняний розпродаж',
    discountTypeLabel: 'Тип знижки',
    discountTypePercent: 'Відсоток %',
    discountTypeFixed: 'Сума ₴',
    discountValueLabel: 'Розмір знижки',
    promoCodeLabel: 'Промокод',
    generateButton: 'Згенерувати',
    sectionScope: 'Область дії',
    scopeAllTitle: 'На всі товари',
    scopeAllDesc: 'Акція застосовується до всього каталогу',
    scopeGroupsTitle: 'На обрані групи',
    scopeGroupsDesc: 'Тільки товари вказаних груп',
    scopeProductsTitle: 'На конкретні позиції',
    scopeProductsDesc: 'Тільки обрані товари',
    noGroups: 'Немає груп товарів',
    noProducts: 'Немає товарів',
    sectionLimits: 'Обмеження',
    limitUsageTitle: 'Ліміт на кількість використань',
    limitUsagePlaceholder: 'Наприклад, 500',
    limitMinOrderTitle: 'Мінімальна сума замовлення',
    limitMinOrderPlaceholder: 'Наприклад, 1000',
    noStackingTitle: 'Заборонити поєднання з іншими знижками',
    excludeWholesaleTitle: 'Не застосовувати до оптових цін',
    sectionDates: 'Строк дії',
    startDateLabel: 'Дата старту',
    endDateLabel: 'Дата завершення',
    setEndDateLabel: 'Задати дату завершення',
    sectionSummary: 'Резюме акції',
    summaryTypeLabel: 'Тип',
    summaryTypePromo: 'Промокод',
    summaryTypeDiscount: 'Знижка',
    summaryNameLabel: 'Назва',
    summaryDiscountLabel: 'Знижка',
    summaryPromoCodeLabel: 'Промокод',
    summaryScopeLabel: 'Область дії',
    summaryGroupsPrefix: 'Групи',
    summaryProductsPrefix: 'Позиції',
    summaryLimitsLabel: 'Обмеження',
    summaryLimitUsagePrefix: 'ліміт',
    summaryLimitMinOrderPrefix: 'від',
    summaryNoStacking: 'без стекінгу',
    summaryExcludeWholesale: 'без опту',
    summaryNone: 'немає',
    summaryDatesLabel: 'Строки',
    summaryFromNoEnd: 'з {date}, безстроково',
    sectionUsageStats: 'Статистика використання',
    statAppliedCount: 'Застосовано разів',
    statOrdersTotal: 'Сума замовлень',
    statDiscountTotal: 'Сума знижок',
    statsHint: 'Статистика почне заповнюватися після першого застосування акції.',
    toastCreated: 'Акцію створено',
    toastCreateError: 'Не вдалося зберегти акцію',
  },
  statistics: {
    days7: '7 днів',
    days30: '30 днів',
    days90: '90 днів',
    statusNew: 'Новий',
    statusProcessing: 'В обробці',
    statusShipped: 'Відправлено',
    statusDone: 'Виконано',
    statusCancelled: 'Скасовано',
    statusPendingPayment: 'Очікує оплати',
    methodNovaPoshta: 'Нова Пошта',
    methodUkrposhta: 'Укрпошта',
    methodPickup: 'Самовивіз',
    methodCourier: 'Кур\'єр',
    methodCod: 'Накладений платіж',
    methodCard: 'Картка онлайн',
    methodCash: 'Готівка',
    methodBankTransfer: 'Банківський переказ',
    methodRequisites: 'За реквізитами',
    weekdayMon: 'Пн',
    weekdayTue: 'Вт',
    weekdayWed: 'Ср',
    weekdayThu: 'Чт',
    weekdayFri: 'Пт',
    weekdaySat: 'Сб',
    weekdaySun: 'Нд',
    pageTitle: 'Статистика',
    pageSubtitle: 'Трафік, продажі, клієнти та ефективність магазину',
    cardVisitors: 'Відвідувачі',
    cardPageViews: 'Перегляди сторінок',
    cardProductViews: 'Перегляди товарів',
    cardAddToCart: 'У кошик',
    cardOrders: 'Замовлення',
    cardRevenuePeriod: 'Виручка за період',
    cardCost: 'Закупівля (собівартість)',
    cardNetProfit: 'Чистий прибуток',
    marginLabel: 'Маржа',
    cardAvgCheck: 'Середній чек',
    avgItemsPerOrderPrefix: 'У середньому',
    avgItemsPerOrderSuffix: 'тов./замовлення',
    cardAbandonedCarts: 'Покинуті кошики',
    potentialPrefix: 'Потенційно',
    chartRevenueProfitTitle: 'Виручка і прибуток за днями',
    seriesRevenue: 'Виручка',
    seriesProfit: 'Прибуток',
    seriesOrders: 'Замовлення',
    funnelTitle: 'Воронка продажів',
    funnelVisitors: 'Відвідувачі',
    funnelProductViews: 'Перегляди товарів',
    funnelAddToCart: 'Додали в кошик',
    funnelOrders: 'Оформили замовлення',
    conversionOverallPrefix: 'Загальна конверсія відвідувача в замовлення',
    conversionCartPrefix: 'Конверсія кошика',
    orderStatusesTitle: 'Статуси замовлень',
    noOrdersPeriod: 'Немає замовлень за період',
    topProductsTitle: 'Топ товарів за період',
    unitsSoldSuffix: 'шт · прибуток',
    profitSuffix: 'прибуток',
    noSalesPeriod: 'Немає продажів за обраний період',
    categorySalesTitle: 'Продажі за категоріями',
    noDataPeriod: 'Немає даних за обраний період',
    weekdayOrdersTitle: 'Замовлення за днями тижня',
    customersTitle: 'Клієнти',
    uniqueLabel: 'Унікальних',
    newLabel: 'Нових',
    returningLabel: 'Повторні покупці',
    topCustomersTitle: 'Топ покупців',
    ordersShortSuffix: 'зам.',
    noData: 'Немає даних',
    deliveryMethodsTitle: 'Способи доставки',
    paymentMethodsTitle: 'Способи оплати',
    trafficDynamicsTitle: 'Динаміка переглядів і замовлень',
    seriesViews: 'Перегляди',
    seriesVisitors: 'Відвідувачі',
    topPagesTitle: 'Популярні сторінки',
    trafficSourcesTitle: 'Джерела трафіку',
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
    system_updates: 'Обновления',
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
  customers: {
    title: 'Клиенты',
    countOne: 'запись',
    countFew: 'записи',
    countMany: 'записей',
    addCustomer: 'Добавить клиента',
    searchPlaceholder: 'Поиск по имени, телефону или email...',
    reliabilityPlaceholder: 'Надежность',
    anyReliability: 'Любая надежность',
    reliabilityHigh: 'Высокая (80+)',
    reliabilityMedium: 'Средняя (50+)',
    find: 'Найти',
    colCustomer: 'Клиент',
    colContacts: 'Контакты',
    colReliability: 'Надежность',
    colOrders: 'Заказы',
    colTurnover: 'Оборот',
    colLastOrder: 'Последний заказ',
    colActions: 'Действия',
    notFound: 'Клиенты не найдены',
    pageLabel: 'Страница',
    removeTagAria: 'Удалить тег',
    actionsAria: 'Действия',
    edit: 'Редактировать',
    addTag: 'Добавить тег',
    delete: 'Удалить',
    pageOf: 'из',
    back: 'Назад',
    next: 'Вперёд',
    addTagTitle: 'Добавить тег',
    tagPlaceholder: 'Например: VIP, Опт, Постоянный',
    cancel: 'Отмена',
    add: 'Добавить',
    deleteTitle: 'Удалить клиента?',
    deleteDescription: 'будет перемещён в архив (мягкое удаление). Данные сохранятся в базе.',
    toastArchived: 'Клиент перемещён в архив',
    toastDeleteError: 'Не удалось удалить клиента',
    toastTagAdded: 'Тег добавлен',
    toastError: 'Ошибка',
    contactViber: 'Viber',
    contactSkype: 'Skype',
    contactWhatsapp: 'WhatsApp',
    contactTelegram: 'Telegram',
    contactEmail: 'Доп. email',
    contactPhone: 'Доп. телефон',
    dialogEditTitle: 'Редактирование клиента',
    dialogNewTitle: 'Новый клиент',
    dialogHint: 'Основная информация и дополнительные каналы связи.',
    firstName: 'Имя *',
    lastName: 'Фамилия',
    firstNamePlaceholder: 'Олександр',
    lastNamePlaceholder: 'Коваленко',
    mainPhone: 'Основной телефон *',
    email: 'Email',
    reliabilityScore: 'Оценка надежности (0–100)',
    contactChannels: 'Каналы связи',
    addChannel: 'Добавить канал связи',
    noChannels: 'Нет дополнительных каналов связи',
    channelValuePlaceholder: 'Значение',
    removeChannelAria: 'Удалить канал',
    note: 'Заметка',
    notePlaceholder: 'Комментарий о клиенте...',
    save: 'Сохранить',
    saving: 'Сохранение...',
    create: 'Создать клиента',
    toastUpdated: 'Клиент обновлён',
    toastCreated: 'Клиент создан',
    toastSaveError: 'Ошибка сохранения',
  },
  settings: {
    pageTitle: 'Настройки',
    pageSubtitle: 'Конфигурация магазина и интеграций',
    saveButton: 'Сохранить',
    navGeneral: 'Основные',
    navHomepage: 'Главная страница',
    navSeo: 'SEO',
    navDesign: 'Дизайн',
    navBranding: 'Логотип',
    navContacts: 'Контакты',
    navWidget: 'Кнопка связи',
    navSocial: 'Соцсети',
    navEmail: 'Email',
    navNotifications: 'Уведомления',
    navAds: 'Google Ads / Analytics',
    navGoogleAuth: 'Вход через Google',
    navSystem: 'Система',
    cacheTitle: 'Кеш сайта',
    cacheDesc:
      'Витрина кеширует каталог, страницы товаров, настройки и отзывы, чтобы работать быстро. Если после изменений (импорт товаров, правки напрямую в базе) на сайте видны старые данные — очистите кеш вручную.',
    clearCacheLabel: 'Очистить кеш',
    clearCacheHint: 'Сбрасывает кеш каталога, товаров, категорий, отзывов и настроек',
    clearCacheButton: 'Очистить кеш',
    toastCacheCleared: 'Кеш очищен — витрина обновится при следующем открытии страниц',
    toastCacheClearError: 'Не удалось очистить кеш',
    storeNameLabel: 'Название магазина',
    storeDescLabel: 'Описание',
    openCartTitle: 'Открывать корзину после добавления',
    openCartDesc: 'Автоматически показывать корзину при добавлении товара',
    heroTitle: 'Hero-блок главной страницы',
    heroDesc:
      'Большой баннер вверху главной страницы: бейдж, заголовок, описание, кнопка и картинка. Пустые поля показывают стандартный текст. Тексты задаются отдельно для каждого языка.',
    localeUk: 'Українська',
    localeRu: 'Русский',
    heroBadgeLabel: 'Бейдж',
    heroBadgeHint: 'Маленькая надпись над заголовком.',
    heroTitleLabel: 'Заголовок',
    heroTextLabel: 'Описание',
    heroButtonLabel: 'Текст кнопки',
    heroButtonHint: 'Кнопка всегда ведёт в каталог.',
    heroImageLabel: 'Картинка hero-блока',
    heroImageHint:
      'Загрузите изображение с устройства или вставьте ссылку. Пусто — стандартная картинка. Общая для обоих языков, рекомендуемое соотношение 4:3.',
    domainLabel: 'Домен магазина',
    domainHint:
      'Канонический адрес сайта. Используется в sitemap.xml, robots.txt, канонических ссылках и Open Graph. Если пусто — определяется автоматически по хостингу.',
    metaTitleLabel: 'Meta title',
    onlineStoreSuffix: '— интернет-магазин',
    charsCount: 'символов',
    metaDescLabel: 'Meta description',
    metaDescPlaceholder: 'Описание магазина для результатов поиска Google',
    keywordsLabel: 'Ключевые слова',
    keywordsPlaceholder: 'электроника, смартфоны, наушники',
    keywordsHint: 'Через запятую.',
    gscHint: 'Значение content из meta-тега подтверждения владения сайтом.',
    gscPlaceholder: 'Код подтверждения (google-site-verification)',
    indexingTitle: 'Индексация в поисковых системах',
    indexingDesc: 'Выключите, чтобы скрыть сайт из Google (noindex) до запуска',
    templateTitle: 'Шаблон витрины',
    templateDesc: 'Выберите оформление магазина. Изменения применяются ко всей витрине после сохранения.',
    premiumBadge: 'Премиум',
    defaultLangTitle: 'Язык по умолчанию',
    defaultLangDesc: 'Язык, предлагаемый новым посетителям при первом входе.',
    imageReplace: 'Заменить',
    imageChooseFile: 'Выбрать файл',
    imageDelete: 'Удалить',
    imageReplaceAria: 'Заменить',
    imageUploadAria: 'Загрузить',
    imageUrlPlaceholder: 'или вставьте ссылку https://...',
    imageUploadError: 'Ошибка загрузки',
    logoLabel: 'Логотип',
    logoHint:
      'Загрузите изображение с устройства или вставьте ссылку. Отображается в шапке админ-центра и магазина.',
    faviconLabel: 'Favicon',
    faviconHint: 'Иконка сайта (32×32). Загрузите файл или вставьте ссылку.',
    phonesTitle: 'Телефоны',
    phonesDesc: 'Можно добавить до 3 номеров. Отображаются в футере магазина.',
    removePhoneAria: 'Удалить номер',
    addPhoneButton: 'Добавить номер',
    addressTitle: 'Адрес магазина',
    addressOptional: '(необязательно)',
    addressPlaceholder: 'г. Киев, ул. Крещатик, 1',
    hoursTitle: 'Время работы',
    dayOff: 'Выходной',
    weekMon: 'Понедельник',
    weekTue: 'Вторник',
    weekWed: 'Среда',
    weekThu: 'Четверг',
    weekFri: 'Пятница',
    weekSat: 'Суббота',
    weekSun: 'Воскресенье',
    widgetTitle: 'Плавающая кнопка связи',
    widgetDesc: 'Кнопка в правом нижнем углу магазина с быстрыми контактами',
    channelsLabel: 'Каналы:',
    enableAllButton: 'Включить все',
    disableAllButton: 'Отключить все',
    widgetFootnote:
      'Кнопка появляется на витрине только если включён общий переключатель и есть хотя бы один активный канал с заполненным значением.',
    channelPhoneLabel: 'Телефон',
    channelPhoneHint: 'Звонок откроется в приложении телефона',
    channelWhatsappLabel: 'WhatsApp',
    channelWhatsappHint: 'Номер в международном формате',
    channelTelegramLabel: 'Telegram',
    channelTelegramHint: 'Имя пользователя или полная ссылка t.me',
    channelTelegramPlaceholder: '@username или ссылка',
    channelViberLabel: 'Viber',
    channelViberHint: 'Номер телефона Viber',
    channelEmailLabel: 'Email',
    channelEmailHint: 'Откроется почтовый клиент',
    emailToggleTitle: 'Email-уведомления',
    emailToggleDesc: 'Отправлять письма клиентам о заказах',
    providerLabel: 'Провайдер',
    fromNameLabel: 'Имя отправителя',
    fromEmailLabel: 'Email отправителя',
    smtpHostLabel: 'SMTP хост',
    smtpPortLabel: 'SMTP порт',
    smtpUserLabel: 'SMTP логин',
    smtpPasswordLabel: 'SMTP пароль',
    smtpTip:
      'Совет: для безопасности храните пароль SMTP в переменной окружения SMTP_PASSWORD. Тогда письма будут отправляться автоматически.',
    dkimTitle: 'DKIM-подпись (антиспам)',
    dkimDesc:
      'Нужна только если ваш SMTP-сервер сам не подписывает письма. Gmail и SendGrid подписывают автоматически — оставьте поля пустыми.',
    dkimSelectorLabel: 'DKIM селектор',
    dkimKeyLabel: 'DKIM приватный ключ (PEM)',
    dnsBoxTitle: 'Чтобы письма не попадали в спам — настройте DNS домена отправителя:',
    dnsSpf: 'TXT-запись: v=spf1 include:_spf.google.com ~all (для Gmail; для другого SMTP — include вашего провайдера)',
    dnsDkim:
      'включите подпись у провайдера (Gmail: Admin console → Apps → Google Workspace → Gmail → Authenticate email) и добавьте выданную TXT-запись',
    dnsDmarc: 'TXT-запись _dmarc.ваш-домен: v=DMARC1; p=quarantine; rua=mailto:admin@ваш-домен',
    dnsImportant:
      '«Email отправителя» должен совпадать с SMTP-логином, иначе письмо уйдёт от имени логина (иное значение станет адресом для ответов)',
    dnsImportantLabel: 'Важно',
    notifSectionTitle: 'Уведомления о новых заказах',
    notifSectionDesc:
      'Кому и как сообщать, когда покупатель оформил заказ. Для писем должна быть настроена вкладка Email (SMTP).',
    customerEmailTitle: 'Письмо покупателю',
    customerEmailDesc: 'Подтверждение заказа на email покупателя (если он его указал)',
    adminEmailTitle: 'Письмо администратору',
    adminEmailDesc: 'Оповещение о каждом новом заказе',
    adminEmailLabel: 'Email администратора',
    adminEmailPlaceholder: 'Пусто = адрес из настроек SMTP',
    telegramTitle: 'Telegram администратору',
    telegramDesc: 'Мгновенное сообщение о заказе в личку или группу',
    telegramTokenLabel: 'Токен бота',
    telegramTokenHint: 'Создайте бота у @BotFather в Telegram и вставьте сюда его токен',
    telegramChatIdLabel: 'Chat ID',
    telegramChatIdHint:
      'Напишите боту /start, затем узнайте свой ID у @userinfobot. Для группы добавьте бота в группу.',
    telegramChatIdPlaceholder: '123456789 или -100123456789 (группа)',
    testButton: 'Отправить тест',
    testNote: 'Перед тестом сохраните настройки или заполните поля выше — тест использует введённые значения.',
    toastTelegramSent: 'Тестовое сообщение отправлено в Telegram',
    toastTelegramError: 'Ошибка отправки',
    convTitle: 'Отслеживание конверсий',
    convDesc: 'Google Ads conversion tracking',
    conversionIdLabel: 'Conversion ID',
    conversionLabelLabel: 'Conversion Label',
    gaTitle: 'Google Analytics (GA4)',
    gaDesc: 'Просмотры страниц, товаров, добавления в корзину, покупки — воронка продаж прямо в GA4',
    gaMeasurementLabel: 'Measurement ID',
    gaHint: 'Найдите в Google Analytics: Администратор → Потоки данных → ваш веб-поток.',
    merchantTitle: 'Google Merchant Center',
    merchantDesc:
      'Товарный фид для Google Shopping/Merchant Center. Добавьте эту ссылку в Merchant Center (Продукты → Фиды → «Заданное время получения»), она обновляется автоматически:',
    merchantLocaleNote: 'Для отдельного фида на русском добавьте ?locale=ru к ссылке.',
    copyButton: 'Копировать',
    toastCopied: 'Скопировано',
    googleAuthTitle: 'Вход через Google (OAuth 2.0)',
    googleAuthDescPrefix: 'Ключи создаются в',
    googleAuthDescLink: 'Google Cloud Console',
    googleAuthDescSuffix:
      '(APIs & Services → Credentials → OAuth client ID, тип «Web application»). Хранятся в базе данных магазина и применяются без перезапуска сервера.',
    googleAuthToggleTitle: 'Кнопка «Войти через Google»',
    googleAuthToggleConfigured: 'Показывать кнопку в окне входа и регистрации',
    googleAuthToggleNotConfigured: 'Заполните Client ID и Client Secret, чтобы включить',
    clientIdLabel: 'Client ID',
    clientSecretLabel: 'Client Secret',
    showSecretAria: 'Показать секрет',
    hideSecretAria: 'Скрыть секрет',
    secretHint: 'Секрет хранится в базе данных. Не передавайте его третьим лицам.',
    redirectTitle: 'Redirect URI для Google Console',
    redirectHint: 'Добавьте этот адрес в «Authorized redirect URIs» вашего OAuth-клиента.',
    uploadErrorDefault: 'Ошибка загрузки',
    toastSettingsSaved: 'Настройки сохранены',
    toastSettingsSaveError: 'Ошибка сохранения',
  },
  updates: {
    title: 'Обновления',
    subtitle: 'Текущая версия системы и проверка новых релизов',
    currentVersionLabel: 'Текущая версия',
    latestVersionLabel: 'Последняя версия',
    upToDate: 'Установлена последняя версия',
    updateAvailable: 'Доступно обновление',
    checkErrorTitle: 'Не удалось проверить обновления',
    checkErrorDesc: 'Проверьте подключение к интернету и попробуйте снова.',
    changelogLink: 'Что нового',
    recheckButton: 'Проверить снова',
    updateButton: 'Обновить',
    updatingButton: 'Обновление…',
    updateStartedTitle: 'Обновление запущено',
    updateStartedDesc:
      'Система загружает новую версию и перезапустится автоматически — это займёт около минуты. Страница будет недоступна короткое время.',
    updateErrorTitle: 'Не удалось запустить обновление',
    updateErrorDesc: 'Попробуйте ещё раз или обновите вручную на сервере.',
    updaterNotConfigured: 'Автообновление не настроено на этом сервере. Обратитесь к Viktor или обновите вручную.',
  },
  delivery: {
    pageTitle: 'Методы доставки',
    pageSubtitle: 'Настройка служб доставки для интернет-магазина',
    npDesc: 'Поиск отделений и почтоматов через API',
    npApiKeyLabel: 'API-ключ Нова Пошта',
    npApiKeyPlaceholder: 'Введите ключ из личного кабинета',
    npApiKeyHintReal: 'Поиск выполняется через реальный API Нова Пошта.',
    npApiKeyHintDemo: 'Без ключа доступен демо-режим с примерами отделений.',
    npCheckTitle: 'Проверка получения: отделения и почтоматы',
    ukrDesc: 'Доставка почтовыми отделениями Укрпошты',
    ukrToggleLabel: 'Доставка Укрпоштой',
    ukrToggleDesc: 'Клиенты смогут выбрать доставку Укрпоштой при оформлении',
    toastUkrEnabled: 'Укрпошта включена',
    toastUkrDisabled: 'Укрпошта отключена',
    badgeActive: 'Активна',
    badgeRequired: 'Обязательная',
    badgeDisabled: 'Отключена',
    searchDemoBadge: 'Демо-режим (укажите API-ключ для реальных данных)',
    searchStep1Label: '1. Город получения',
    searchCityPlaceholder: 'Начните вводить город, например Київ',
    searchFindButton: 'Найти',
    searchRegionSuffix: 'обл.',
    searchStep2LabelPrefix: '2. Пункт выдачи в городе',
    searchTabBranch: 'Отделения',
    searchTabPostomat: 'Почтоматы',
    searchWhFilterPlaceholder: 'Фильтр по номеру или адресу',
    searchLoading: 'Загрузка...',
    searchNothingFound: 'Ничего не найдено',
    searchMaxWeightPrefix: 'до',
    searchMaxWeightSuffix: 'кг',
  },
  payments: {
    pageTitle: 'Платежи',
    pageSubtitle: 'Приём оплат и возврат средств через WayForPay и Monobank',
    tabProcessing: 'Обработка',
    tabMethods: 'Способы оплаты',
    tabGateways: 'Шлюзы',
    statusCreated: 'Создан',
    statusPending: 'Ожидает оплаты',
    statusPaid: 'Оплачен',
    statusPartiallyRefunded: 'Частичный возврат',
    statusRefunded: 'Возвращён',
    statusFailed: 'Ошибка',
    statusExpired: 'Истёк',
    statTotal: 'Всего платежей',
    statPaid: 'Оплачено',
    statRefunded: 'Возвращено',
    statPending: 'В ожидании',
    createButton: 'Создать платёж',
    colOrder: 'Заказ',
    colGateway: 'Шлюз',
    colAmount: 'Сумма',
    colStatus: 'Статус',
    colCustomer: 'Клиент',
    colDate: 'Дата',
    colActions: 'Действия',
    emptyPayments: 'Платежей пока нет',
    refundedPrefix: 'возврат',
    openPayment: 'Открыть оплату',
    refreshStatus: 'Обновить статус',
    markPaid: 'Отметить оплаченным',
    refundAction: 'Возврат средств',
    newPaymentTitle: 'Новый платёж',
    newPaymentDesc: 'Создаётся счёт в выбранном шлюзе и формируется ссылка на оплату.',
    noActiveGateways: 'Нет активных шлюзов. Активируйте WayForPay или Monobank во вкладке «Шлюзы».',
    gatewayLabel: 'Шлюз *',
    gatewaySelectPlaceholder: 'Выберите шлюз',
    currencyLabel: 'Валюта',
    amountLabel: 'Сумма *',
    descLabel: 'Назначение платежа',
    descPlaceholder: 'Оплата заказа №...',
    customerLabel: 'Клиент',
    phoneLabel: 'Телефон',
    emailLabel: 'Email',
    createInvoiceButton: 'Создать счёт',
    refundDialogTitle: 'Возврат средств',
    refundDialogDescPrefix: 'Платёж',
    refundDialogAlreadyRefunded: 'Уже возвращено',
    refundAmountLabel: 'Сумма возврата',
    refundHintPrefix: 'Возврат выполняется через API',
    refundHintSuffix: 'Возможен частичный возврат.',
    confirmRefundButton: 'Вернуть средства',
    toastSelectGateway: 'Выберите платёжный шлюз',
    toastInvalidAmount: 'Укажите корректную сумму',
    toastRefundAmount: 'Укажите сумму возврата',
    wfpMerchantLoginHint: 'Логин мерчанта из личного кабинета WayForPay (напр. test_skycrms_pp_ua)',
    wfpSecretKeyHint: 'Секретный ключ для подписи запросов (HMAC-MD5)',
    wfpDomainHint: 'Домен сайта, например shop.example.com',
    wfpPasswordHint: 'Необязательно. Пароль мерчанта из кабинета — для операций, где он требуется. В подписи платёжного API не используется.',
    monobankTokenLabel: 'Токен эквайринга (X-Token)',
    monobankTokenHint: 'Токен из кабинета Monobank Acquiring',
    optionalLabel: '(необязательно)',
    copiedToast: 'Скопировано',
    copyFailedToast: 'Не удалось скопировать',
    copyAria: 'Скопировать',
    serviceUrlLabel: 'Service URL (уведомления о платежах)',
    approvedUrlLabel: 'approvedUrl / declinedUrl (возврат клиента)',
    webhookUrlLabel: 'Webhook URL (уведомления о платежах)',
    redirectUrlLabel: 'Redirect URL (возврат клиента)',
    urlsSectionTitlePrefix: 'Ссылки для личного кабинета',
    urlsHintPrefix: 'Заполнять необязательно: магазин передаёт эти адреса автоматически с каждым платежом. Укажите их в кабинете',
    urlsHintWfpSuffix: 'WayForPay (раздел «Уведомления»)',
    urlsHintMonoSuffix: 'Monobank',
    urlsHintEnd: 'как запасной вариант.',
    wfpDesc: 'Оплата картой, Apple Pay, Google Pay',
    monoDesc: 'Эквайринг Monobank для бизнеса',
    badgeActiveGateway: 'Активен',
    badgeDisabledGateway: 'Отключён',
    badgeTestMode: 'Тест',
    toastFillFields: 'Заполните все поля перед активацией шлюза',
    activeSwitchLabel: 'Активен',
    activeSwitchDesc: 'Доступен для приёма оплат',
    testSwitchLabel: 'Тестовый режим',
    testSwitchDesc: 'Разрешить ручную отметку оплаты',
    statusEnabled: 'Включён',
    statusDisabledMethod: 'Отключён',
    availableAtCheckoutLabel: 'Доступен при оформлении',
    customerCanChooseDesc: 'Клиент сможет выбрать этот способ',
    codHint: 'Оплата при получении товара',
    onlineHint: 'Оплата через подключённые платёжные шлюзы',
    activeGatewaysPrefix: 'Активные шлюзы:',
    noActiveGatewaysHint: 'Нет активных шлюзов — включите их на вкладке «Шлюзы».',
    requisitesDesc: 'Оплата на карту или по банковским реквизитам',
    requisitesTypeLabel: 'Тип реквизитов',
    tabCard: 'Оплата на карту',
    tabRequisites: 'По реквизитам',
    cardNumberLabel: 'Номер карты',
    cardHolderLabel: 'ФИО получателя',
    edrpouLabel: 'ЕГРПОУ или РНУКПН',
    recipientNameLabel: 'Название получателя',
    ibanLabel: 'Счёт IBAN',
    toastCardFieldsRequired: 'Укажите номер карты и ФИО получателя',
    toastRequisitesFieldsRequired: 'Заполните ЕГРПОУ/РНУКПН, получателя и IBAN',
    toastMethodEnabledSuffix: 'включён',
    toastMethodDisabledSuffix: 'отключён',
  },
  promotions: {
    tabAll: 'Все',
    tabActive: 'Активные',
    tabInactive: 'Неактивные',
    searchPlaceholder: 'Поиск по названию…',
    emptyTitle: 'Тут пока ничего нет',
    emptyDesc: 'Создайте первую акцию или промокод, чтобы привлекать покупателей и увеличивать продажи.',
    addButton: 'Добавить акцию',
    pageTitle: 'Акции и промокоды',
    pageSubtitle: 'Управление скидками, промокодами и таргетингом',
    noResults: 'По вашему запросу ничего не найдено.',
    deleteDialogTitle: 'Удалить акцию?',
    deleteDialogDesc: 'Действие нельзя отменить. Статистика использования также будет удалена.',
    toastActivated: 'Акция активирована',
    toastDeactivated: 'Акция отключена',
    toastDeleted: 'Акция удалена',
    toastCodeCopied: 'Промокод скопирован',
    targetAll: 'Все товары',
    targetGroups: 'Выбранные группы',
    targetProducts: 'Конкретные позиции',
    noEndDate: 'бессрочно',
    usedLabel: 'Использовано',
    totalDiscountLabel: 'Сумма скидок',
    statusSr: 'Статус акции',
    actionsAria: 'Действия',
    copyCodeAction: 'Копировать код',
    formSubtitle: 'Настройте скидку, таргетинг и ограничения',
    backAria: 'Назад',
    formTitleNew: 'Новая акция',
    saveButtonSaving: 'Сохранение…',
    saveButtonDefault: 'Сохранить акцию',
    sectionMainInfo: 'Основная информация',
    typePromoTitle: 'Промокод',
    typePromoDesc: 'Код для покупателя',
    typeDiscountTitle: 'Скидка',
    typeDiscountDesc: 'Автоматическая',
    nameLabel: 'Название акции',
    namePlaceholder: 'Например, Весенний розпродаж',
    discountTypeLabel: 'Тип скидки',
    discountTypePercent: 'Процент %',
    discountTypeFixed: 'Сумма ₴',
    discountValueLabel: 'Размер скидки',
    promoCodeLabel: 'Промокод',
    generateButton: 'Сгенерировать',
    sectionScope: 'Область действия',
    scopeAllTitle: 'На все товары',
    scopeAllDesc: 'Акция применяется ко всему каталогу',
    scopeGroupsTitle: 'На выбранные группы',
    scopeGroupsDesc: 'Только товары указанных групп',
    scopeProductsTitle: 'На конкретные позиции',
    scopeProductsDesc: 'Только выбранные товары',
    noGroups: 'Нет групп товаров',
    noProducts: 'Нет товаров',
    sectionLimits: 'Ограничения',
    limitUsageTitle: 'Лимит на количество использований',
    limitUsagePlaceholder: 'Например, 500',
    limitMinOrderTitle: 'Минимальная сумма заказа',
    limitMinOrderPlaceholder: 'Например, 1000',
    noStackingTitle: 'Запретить совмещение с другими скидками',
    excludeWholesaleTitle: 'Не применять к оптовым ценам',
    sectionDates: 'Сроки действия',
    startDateLabel: 'Дата старта',
    endDateLabel: 'Дата окончания',
    setEndDateLabel: 'Задать дату окончания',
    sectionSummary: 'Резюме акции',
    summaryTypeLabel: 'Тип',
    summaryTypePromo: 'Промокод',
    summaryTypeDiscount: 'Скидка',
    summaryNameLabel: 'Название',
    summaryDiscountLabel: 'Скидка',
    summaryPromoCodeLabel: 'Промокод',
    summaryScopeLabel: 'Область действия',
    summaryGroupsPrefix: 'Группы',
    summaryProductsPrefix: 'Позиции',
    summaryLimitsLabel: 'Ограничения',
    summaryLimitUsagePrefix: 'лимит',
    summaryLimitMinOrderPrefix: 'от',
    summaryNoStacking: 'без стекинга',
    summaryExcludeWholesale: 'без опта',
    summaryNone: 'нет',
    summaryDatesLabel: 'Сроки',
    summaryFromNoEnd: 'с {date}, бессрочно',
    sectionUsageStats: 'Статистика использования',
    statAppliedCount: 'Применено раз',
    statOrdersTotal: 'Сумма заказов',
    statDiscountTotal: 'Сумма скидок',
    statsHint: 'Статистика начнёт заполняться после первого применения акции.',
    toastCreated: 'Акция создана',
    toastCreateError: 'Не удалось сохранить акцию',
  },
  statistics: {
    days7: '7 дней',
    days30: '30 дней',
    days90: '90 дней',
    statusNew: 'Новый',
    statusProcessing: 'В обработке',
    statusShipped: 'Отправлен',
    statusDone: 'Выполнен',
    statusCancelled: 'Отменён',
    statusPendingPayment: 'Ждёт оплаты',
    methodNovaPoshta: 'Нова Пошта',
    methodUkrposhta: 'Укрпошта',
    methodPickup: 'Самовывоз',
    methodCourier: 'Курьер',
    methodCod: 'Наложенный платёж',
    methodCard: 'Карта онлайн',
    methodCash: 'Наличные',
    methodBankTransfer: 'Банковский перевод',
    methodRequisites: 'По реквизитам',
    weekdayMon: 'Пн',
    weekdayTue: 'Вт',
    weekdayWed: 'Ср',
    weekdayThu: 'Чт',
    weekdayFri: 'Пт',
    weekdaySat: 'Сб',
    weekdaySun: 'Вс',
    pageTitle: 'Статистика',
    pageSubtitle: 'Трафик, продажи, клиенты и эффективность магазина',
    cardVisitors: 'Посетители',
    cardPageViews: 'Просмотры страниц',
    cardProductViews: 'Просмотры товаров',
    cardAddToCart: 'В корзину',
    cardOrders: 'Заказы',
    cardRevenuePeriod: 'Выручка за период',
    cardCost: 'Закупка (себестоимость)',
    cardNetProfit: 'Чистая прибыль',
    marginLabel: 'Маржа',
    cardAvgCheck: 'Средний чек',
    avgItemsPerOrderPrefix: 'В среднем',
    avgItemsPerOrderSuffix: 'тов./заказ',
    cardAbandonedCarts: 'Брошенные корзины',
    potentialPrefix: 'Потенциально',
    chartRevenueProfitTitle: 'Выручка и прибыль по дням',
    seriesRevenue: 'Выручка',
    seriesProfit: 'Прибыль',
    seriesOrders: 'Заказы',
    funnelTitle: 'Воронка продаж',
    funnelVisitors: 'Посетители',
    funnelProductViews: 'Просмотры товаров',
    funnelAddToCart: 'Добавили в корзину',
    funnelOrders: 'Оформили заказ',
    conversionOverallPrefix: 'Общая конверсия посетителя в заказ',
    conversionCartPrefix: 'Конверсия корзины',
    orderStatusesTitle: 'Статусы заказов',
    noOrdersPeriod: 'Нет заказов за период',
    topProductsTitle: 'Топ товаров за период',
    unitsSoldSuffix: 'шт · прибыль',
    profitSuffix: 'прибыль',
    noSalesPeriod: 'Нет продаж за выбранный период',
    categorySalesTitle: 'Продажи по категориям',
    noDataPeriod: 'Нет данных за выбранный период',
    weekdayOrdersTitle: 'Заказы по дням недели',
    customersTitle: 'Клиенты',
    uniqueLabel: 'Уникальных',
    newLabel: 'Новых',
    returningLabel: 'Повторные покупатели',
    topCustomersTitle: 'Топ покупателей',
    ordersShortSuffix: 'зак.',
    noData: 'Нет данных',
    deliveryMethodsTitle: 'Способы доставки',
    paymentMethodsTitle: 'Способы оплаты',
    trafficDynamicsTitle: 'Динамика просмотров и заказов',
    seriesViews: 'Просмотры',
    seriesVisitors: 'Посетители',
    topPagesTitle: 'Популярные страницы',
    trafficSourcesTitle: 'Источники трафика',
  },
}

const dictionaries: Record<Locale, AdminDictionary> = { uk, ru }

export function getAdminDictionary(locale: Locale): AdminDictionary {
  return dictionaries[locale]
}
