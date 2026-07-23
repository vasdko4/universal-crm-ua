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
    trafficSource: string
    utmCampaign: string
    utmMedium: string
    utmTerm: string
    utmContent: string
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
  groups: {
    title: string
    subtitle: string
    countOne: string
    countFew: string
    countMany: string
    addGroup: string
    colName: string
    colSlug: string
    colProducts: string
    colSortOrder: string
    colStatus: string
    colActions: string
    notFound: string
    deactivateAria: string
    activateAria: string
    active: string
    inactive: string
    editAria: string
    deleteAria: string
    editTitle: string
    newTitle: string
    dialogHint: string
    nameRu: string
    nameUk: string
    descriptionRu: string
    sortOrder: string
    isActive: string
    cancel: string
    save: string
    create: string
    deleteTitle: string
    deleteDescription: string
    delete: string
    toastFillBothLanguages: string
    toastUpdated: string
    toastCreated: string
    toastSaveError: string
    toastDeleted: string
    toastDeleteError: string
  }
  trash: {
    title: string
    subtitle: string
    restore: string
    deleteForever: string
    deleteSelectedTitle: string
    deleteSelectedDescription: string
    cancel: string
    emptyTrash: string
    emptyTrashTitle: string
    emptyTrashDescription: string
    itemOne: string
    itemFew: string
    itemMany: string
    empty: string
    selectAllAria: string
    selectRowAria: string
    colName: string
    colSku: string
    colPrice: string
    colQuantity: string
    colDeletedAt: string
    colActions: string
    noName: string
    restoreAria: string
    deleteForeverAria: string
    toastRestored: string
    toastRestoreError: string
    toastDeletedForever: string
    toastDeleteError: string
    toastEmptied: string
    toastEmptyError: string
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
    minOrderTitle: string
    minOrderDesc: string
    minOrderAmountLabel: string
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
    ogImageLabel: string
    ogImageHint: string
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
    enhancedConvTitle: string
    enhancedConvDesc: string
    merchantTitle: string
    merchantDesc: string
    merchantLocaleNote: string
    merchantCategoryLabel: string
    merchantCategoryPlaceholder: string
    merchantCategoryHint: string
    merchantShippingPriceLabel: string
    merchantShippingPricePlaceholder: string
    merchantShippingCountryLabel: string
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
  import: {
    pageTitle: string
    pageSubtitle: string
    uploadCardTitle: string
    uploadCardDescription: string
    chooseFileButton: string
    rowsBadgeTemplate: string
    colName: string
    colSku: string
    colPrice: string
    colQty: string
    showingFirstTemplate: string
    importButtonTemplate: string
    historyCardTitle: string
    tableFile: string
    tableType: string
    tableStatus: string
    tableTotal: string
    tableSuccess: string
    tableFailed: string
    tableDate: string
    noImportsYet: string
    statusCompleted: string
    statusProcessing: string
    statusFailed: string
    statusPending: string
    promCardTitle: string
    promCardDescription: string
    promUrlPlaceholder: string
    promStartButton: string
    promContinueButton: string
    promUnfinishedTitle: string
    promProcessedOfTotalTemplate: string
    promImportingSuffix: string
    promDoneSuffix: string
    promCompleteToast: string
    errorParsingFile: string
    errorGeneric: string
    errorStart: string
    promFoundTemplate: string
    promFoundCappedTemplate: string
    importedResultTemplate: string
  }
  feedback: {
    pageTitle: string
    pageSubtitle: string
    statReviews: string
    statPending: string
    statQuestions: string
    statUnanswered: string
    tabReviews: string
    tabQuestions: string
    filterAllTemplate: string
    filterPendingReviewsTemplate: string
    filterApprovedTemplate: string
    filterRejectedTemplate: string
    filterUnansweredTemplate: string
    filterAnsweredTemplate: string
    verifiedPurchase: string
    approveButton: string
    rejectButton: string
    deleteAria: string
    aboutProductPrefix: string
    helpfulSuffix: string
    storeReplyLabel: string
    replyPlaceholder: string
    replyButton: string
    answerPlaceholder: string
    answerButton: string
    noReviews: string
    noQuestions: string
    deleteReviewTitle: string
    deleteReviewDescription: string
    deleteQuestionTitle: string
    deleteQuestionDescription: string
    statusApproved: string
    statusRejected: string
    statusAnswered: string
    statusPending: string
    ratingAriaTemplate: string
    pageOfTemplate: string
    backButton: string
    forwardButton: string
    toastReviewApproved: string
    toastReviewRejected: string
    toastReviewPending: string
    toastReplySaved: string
    toastReviewDeleted: string
    toastEnterAnswer: string
    toastAnswerPublished: string
    toastQuestionDeleted: string
    toastGenericError: string
  }
  logs: {
    pageTitle: string
    pageSubtitle: string
    searchPlaceholder: string
    sectionPlaceholder: string
    allSections: string
    actionPlaceholder: string
    allActions: string
    refreshAria: string
    clearAria: string
    clearTitle: string
    clearDescription: string
    clearButton: string
    colDate: string
    colUser: string
    colAction: string
    colSection: string
    colDetails: string
    colIp: string
    noRecords: string
    pageOfTotalTemplate: string
    backButton: string
    forwardButton: string
    actionLogin: string
    actionCreate: string
    actionUpdate: string
    actionDelete: string
    actionToggle: string
    actionSettings: string
    actionSecurity: string
    entityAuth: string
    entityProduct: string
    entityOrder: string
    entityUser: string
    entitySettings: string
    entityModalAd: string
    entityPromotion: string
    entityCategory: string
    entityLogs: string
    entityRole: string
  }
  guides: {
    pageTitle: string
    pageSubtitle: string
    searchPlaceholder: string
    tocAriaLabel: string
    nothingFound: string
    openSection: string
    noResultsPrefix: string
    noResultsSuffix: string
  }
  abandonedCarts: {
    pageTitle: string
    pageSubtitle: string
    refreshButton: string
    statOpen: string
    statReminded: string
    statRecovered: string
    statPotentialRevenue: string
    filterActive: string
    filterRecovered: string
    filterAll: string
    emptyActive: string
    emptyGeneric: string
    noName: string
    orderNumberPrefix: string
    remindedAtPrefix: string
    hideButton: string
    remindButton: string
    remindNoEmailTitle: string
    statusOpen: string
    statusReminded: string
    statusRecovered: string
    itemQtyTemplate: string
    toastReminderSent: string
    timeMinutesAgo: string
    timeHoursAgo: string
    timeDaysAgo: string
  }
  notFound: {
    errorLabel: string
    title: string
    description: string
    goToAdmin: string
  }
  accessDenied: {
    errorLabel: string
    title: string
    reasonWithSection: string
    reasonGeneric: string
    contactHint: string
    goToAdmin: string
    goToSite: string
  }
  bestsellers: {
    title: string
    subtitle: string
    statRankedItems: string
    statUnitsSold: string
    statRevenue: string
    colRank: string
    colProduct: string
    colUnitsSold: string
    colOrders: string
    colRevenue: string
    colTop: string
    topAria: string
    empty: string
    toastAdded: string
    toastRemoved: string
    toastNoProduct: string
  }
  dashboard: {
    welcome: string
    subtitle: string
    statOrdersTotal: string
    statOrdersActive: string
    statRevenue: string
    statViews: string
    recentOrdersTitle: string
    allOrders: string
    noOrders: string
    noName: string
    unitsSuffix: string
    funnelTitle: string
    funnelPageViews: string
    funnelProductViews: string
    funnelAddToCart: string
    funnelOrders: string
    conversionRate: string
    lowStockTitle: string
    toProducts: string
    skuLabel: string
    outOfStock: string
    remainingPrefix: string
  }
  pages: {
    title: string
    subtitle: string
    createPage: string
    tabAll: string
    tabPublished: string
    tabDraft: string
    searchPlaceholder: string
    colTitle: string
    colUrl: string
    colStatus: string
    colInMenu: string
    empty: string
    yes: string
    published: string
    draft: string
    actionsAria: string
    edit: string
    unpublish: string
    publish: string
    delete: string
    pageOf: string
    back: string
    next: string
    deleteTitle: string
    deleteDescription: string
    cancel: string
    toastUnpublished: string
    toastPublished: string
    toastDeleted: string
    dialogTitleEdit: string
    dialogTitleCreate: string
    dialogDescription: string
    tabContent: string
    tabSettings: string
    tabSeo: string
    titleUk: string
    titleRu: string
    titleUkPlaceholder: string
    titleRuPlaceholder: string
    slugLabel: string
    langUk: string
    langRu: string
    excerptUk: string
    excerptRu: string
    excerptPlaceholder: string
    contentUk: string
    contentRu: string
    contentPlaceholder: string
    templateLabel: string
    templateDefault: string
    templateContacts: string
    templateFaq: string
    templateLanding: string
    publishLabel: string
    publishHint: string
    showInMenuLabel: string
    showInMenuHint: string
    menuTitleLabel: string
    sortOrderLabel: string
    metaTitleLabel: string
    metaTitlePlaceholder: string
    metaDescLabel: string
    metaDescPlaceholder: string
    save: string
    saving: string
    create: string
    toastTitleRequired: string
    toastUpdated: string
    toastCreated: string
    toastSaveError: string
  }
  users: {
    title: string
    subtitle: string
    tabUsers: string
    tabRoles: string
    addUser: string
    newUserTitle: string
    nameLabel: string
    emailLabel: string
    passwordLabel: string
    roleLabel: string
    create: string
    toastUserCreated: string
    genericError: string
    colUser: string
    colRole: string
    colStatus: string
    colActions: string
    youSuffix: string
    toastRoleUpdated: string
    active: string
    disabled: string
    deleteUserConfirm: string
    toastUserDeleted: string
    createRole: string
    systemRole: string
    customRole: string
    accessCountLabel: string
    allSections: string
    edit: string
    deleteRoleConfirm: string
    toastRoleDeleted: string
    dialogTitleEdit: string
    dialogTitleCreate: string
    codeLabel: string
    descriptionLabel: string
    adminRoleHint: string
    sectionAccessLabel: string
    cancel: string
    save: string
    toastRoleSaved: string
  }
  articles: {
    title: string
    subtitle: string
    newArticle: string
    tabAll: string
    tabPublished: string
    tabDraft: string
    categoryPlaceholder: string
    allCategories: string
    searchPlaceholder: string
    empty: string
    published: string
    draft: string
    featuredBadge: string
    actionsAria: string
    edit: string
    unpublish: string
    publish: string
    featuredAdd: string
    featuredRemove: string
    delete: string
    minutesSuffix: string
    pageOf: string
    back: string
    next: string
    deleteTitle: string
    deleteDescription: string
    cancel: string
    toastUnpublished: string
    toastPublished: string
    toastFeaturedAdded: string
    toastFeaturedRemoved: string
    toastDeleted: string
    dialogTitleEdit: string
    dialogTitleCreate: string
    dialogDescription: string
    tabContent: string
    tabSettings: string
    tabSeo: string
    titleLabel: string
    titlePlaceholder: string
    slugLabel: string
    excerptLabel: string
    excerptPlaceholder: string
    contentLabel: string
    contentPlaceholder: string
    categoryLabel: string
    noCategory: string
    authorLabel: string
    coverLabel: string
    readingMinutesLabel: string
    tagsLabel: string
    tagsPlaceholder: string
    addTag: string
    removeTagAria: string
    publishLabel: string
    publishHint: string
    featuredLabel: string
    featuredHint: string
    metaTitleLabel: string
    metaDescLabel: string
    save: string
    saving: string
    create: string
    toastTitleRequired: string
    toastUpdated: string
    toastCreated: string
    toastSaveError: string
  }
  modalAds: {
    title: string
    subtitle: string
    newCampaign: string
    statCampaigns: string
    statViews: string
    statClicks: string
    statCtr: string
    searchPlaceholder: string
    tabAll: string
    tabActive: string
    tabInactive: string
    empty: string
    emptyHint: string
    createCampaign: string
    active: string
    inactive: string
    enableCampaignAria: string
    actionsAria: string
    edit: string
    resetStats: string
    delete: string
    statViewsShort: string
    statClicksShort: string
    statClosesShort: string
    paginationAria: string
    secSuffix: string
    sinceLabel: string
    untilLabel: string
    dialogTitleEdit: string
    dialogTitleCreate: string
    dialogDescription: string
    sectionContent: string
    campaignNameLabel: string
    campaignNamePlaceholder: string
    bannerTitleLabel: string
    bannerTitlePlaceholder: string
    textLabel: string
    textPlaceholder: string
    bannerImageLabel: string
    bannerImageHint: string
    windowSizeLabel: string
    sizeSmall: string
    sizeMedium: string
    sizeLarge: string
    buttonTextLabel: string
    buttonTextPlaceholder: string
    buttonUrlLabel: string
    buttonColorLabel: string
    colorTheme: string
    colorRed: string
    colorOrange: string
    colorGreen: string
    colorBlue: string
    colorBlack: string
    customColorLabel: string
    customColorAria: string
    previewLabel: string
    sectionWhereToShow: string
    pageAll: string
    pageHome: string
    pageCatalog: string
    pageProduct: string
    pageCart: string
    sectionTrigger: string
    triggerDelay: string
    triggerDelayHint: string
    triggerScroll: string
    triggerScrollHint: string
    triggerExit: string
    triggerExitHint: string
    delaySecondsLabel: string
    scrollPercentLabel: string
    sectionFrequency: string
    freqEvery: string
    freqSession: string
    freqDays: string
    daysBetweenAria: string
    daysSuffix: string
    sectionSchedule: string
    startLabel: string
    endLabel: string
    campaignEnabledLabel: string
    cancel: string
    save: string
    create: string
    toastSaveError: string
    toastUpdated: string
    toastCreated: string
    toastDeleted: string
    toastStatsReset: string
    deleteTitle: string
    deleteDescription: string
  }
  productAnalytics: {
    title: string
    period: string
    views: string
    addToCart: string
    unitsSold: string
    revenue: string
    cartRate: string
    purchaseRate: string
  }
  productVariants: {
    axesTitle: string
    axesHint: string
    typeColor: string
    typeText: string
    removeAxisAria: string
    valuesLabel: string
    colorPlaceholder: string
    textPlaceholder: string
    colorForAria: string
    newAxisLabel: string
    newAxisPlaceholder: string
    selectText: string
    selectColor: string
    addAxis: string
    generateMatrix: string
    combinationsTitle: string
    combinationLabel: string
    priceLabel: string
    oldPriceLabel: string
    quantityLabel: string
    skuLabel: string
    variantImageLabel: string
  }
  productForm: {
    backToListAria: string
    editTitle: string
    createTitle: string
    idPrefix: string
    fillInfoHint: string
    cancel: string
    save: string
    createProduct: string
    tabMain: string
    tabPrice: string
    tabVariants: string
    tabCategories: string
    tabChars: string
    tabSeo: string
    photosTitle: string
    mainPhotoLabel: string
    mainPhotoHint: string
    galleryLabel: string
    galleryHint: string
    nameSectionTitle: string
    nameRuLabel: string
    nameRuPlaceholder: string
    nameUkLabel: string
    nameUkPlaceholder: string
    descRuLabel: string
    descUkLabel: string
    notesLabel: string
    identificationTitle: string
    skuLabel: string
    barcodeLabel: string
    salesTypeLabel: string
    salesTypeRetail: string
    salesTypeWholesale: string
    salesTypeBoth: string
    visibleLabel: string
    visibleHint: string
    popularLabel: string
    popularHint: string
    purchaseCounterTitle: string
    realOrdersLabel: string
    realOrdersHint: string
    purchasesBoostLabel: string
    purchasesBoostHint: string
    shownToBuyersLabel: string
    shownToBuyersHint: string
    dimensionsTitle: string
    widthLabel: string
    heightLabel: string
    lengthLabel: string
    weightLabel: string
    pricesTitle: string
    priceLabel: string
    oldPriceLabel: string
    costPriceLabel: string
    currencyLabel: string
    priceFromLabel: string
    priceFromHint: string
    stockTitle: string
    quantityLabel: string
    quantityHint: string
    quantityHintVariants: string
    unitLabel: string
    variantsActiveNotice: string
    variantsToggleLabel: string
    variantsToggleHint: string
    variantsOffHint: string
    productCategoriesTitle: string
    noCategoriesHint: string
    createCategoryLink: string
    productGroupsTitle: string
    noGroupsHint: string
    createGroupLink: string
    placementTitle: string
    siteGroupLabel: string
    notSelected: string
    marketplaceCategoryLabel: string
    charsTitle: string
    charsEmptyHint: string
    charNamePlaceholder: string
    charNameAria: string
    charValuePlaceholder: string
    charValueAria: string
    removeCharAria: string
    addChar: string
    seoTitle: string
    metaTitleRuLabel: string
    metaTitleUkLabel: string
    metaDescRuLabel: string
    metaDescUkLabel: string
    toastNameRequired: string
    toastPriceInvalid: string
    toastUpdated: string
    toastCreated: string
    toastSaveError: string
    saveChanges: string
  }
  auditLog: {
    cartReminderSent: string
    cartsHidden: string
    logsClearedOld: string
    logsClearedAll: string
    campaignCreated: string
    campaignUpdated: string
    campaignEnabled: string
    campaignDisabled: string
    campaignDeleted: string
    orderStatusChanged: string
    orderCreated: string
    paymentStatusChanged: string
    trackingCreated: string
    productCreated: string
    productUpdated: string
    productsTrashed: string
    settingsUpdated: string
    settingsUnchanged: string
    cacheCleared: string
    userCreated: string
    userRoleChanged: string
    userActivated: string
    userDeactivated: string
    userDeleted: string
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
    trafficSource: 'Джерело трафіку',
    utmCampaign: 'Кампанія',
    utmMedium: 'Канал',
    utmTerm: 'Ключове слово',
    utmContent: 'Контент оголошення',
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
  groups: {
    title: 'Групи товарів',
    subtitle: 'Добірки товарів для вітрин і акцій',
    countOne: 'група',
    countFew: 'групи',
    countMany: 'груп',
    addGroup: 'Додати групу',
    colName: 'Назва',
    colSlug: 'Slug',
    colProducts: 'Товарів',
    colSortOrder: 'Порядок',
    colStatus: 'Статус',
    colActions: 'Дії',
    notFound: 'Груп поки немає',
    deactivateAria: 'Деактивувати групу',
    activateAria: 'Активувати групу',
    active: 'Активна',
    inactive: 'Неактивна',
    editAria: 'Редагувати',
    deleteAria: 'Видалити',
    editTitle: 'Редагувати групу',
    newTitle: 'Нова група',
    dialogHint: 'Групи об’єднують товари в добірки: «Хіти продажів», «Новинки» тощо.',
    nameRu: 'Назва (RU) *',
    nameUk: 'Назва (UK) *',
    descriptionRu: 'Опис (RU)',
    sortOrder: 'Порядок сортування',
    isActive: 'Активна',
    cancel: 'Скасувати',
    save: 'Зберегти',
    create: 'Створити',
    deleteTitle: 'Видалити групу?',
    deleteDescription: 'буде видалена. Товари залишаться, але зв’язки з групою будуть видалені.',
    delete: 'Видалити',
    toastFillBothLanguages: 'Заповніть назву обома мовами',
    toastUpdated: 'Групу оновлено',
    toastCreated: 'Групу створено',
    toastSaveError: 'Помилка збереження',
    toastDeleted: 'Групу видалено',
    toastDeleteError: 'Помилка видалення',
  },
  trash: {
    title: 'Кошик',
    subtitle: 'Видалені товари. Їх можна відновити або видалити назавжди.',
    restore: 'Відновити',
    deleteForever: 'Видалити назавжди',
    deleteSelectedTitle: 'Видалити вибрані товари назавжди?',
    deleteSelectedDescription: 'Ця дія незворотна. Товари та всі пов’язані дані будуть видалені з бази.',
    cancel: 'Скасувати',
    emptyTrash: 'Очистити кошик',
    emptyTrashTitle: 'Очистити кошик повністю?',
    emptyTrashDescription: 'будуть видалені безповоротно.',
    itemOne: 'товар',
    itemFew: 'товари',
    itemMany: 'товарів',
    empty: 'Кошик порожній',
    selectAllAria: 'Вибрати всі',
    selectRowAria: 'Вибрати',
    colName: 'Назва',
    colSku: 'Артикул',
    colPrice: 'Ціна',
    colQuantity: 'К-сть',
    colDeletedAt: 'Видалено',
    colActions: 'Дії',
    noName: 'Без назви',
    restoreAria: 'Відновити',
    deleteForeverAria: 'Видалити назавжди',
    toastRestored: 'Відновлено товарів',
    toastRestoreError: 'Помилка відновлення',
    toastDeletedForever: 'Видалено назавжди',
    toastDeleteError: 'Помилка видалення',
    toastEmptied: 'Кошик очищено',
    toastEmptyError: 'Помилка очищення кошика',
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
    minOrderTitle: 'Мінімальна сума замовлення',
    minOrderDesc: 'Заборонити оформлення замовлення, якщо сума товарів менша за поріг',
    minOrderAmountLabel: 'Мінімальна сума, ₴',
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
    ogImageLabel: 'Картинка для посилання (Open Graph)',
    ogImageHint:
      'Показується у прев\u2019ю, коли посилання на сайт надсилають у Telegram, Viber, Instagram, Slack тощо (1200×630). Якщо не завантажено — використовується стандартна картинка.',
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
    enhancedConvTitle: 'Enhanced Conversions',
    enhancedConvDesc:
      'Надсилає захешований email/телефон покупця разом із конверсією покупки — Google точніше зіставляє конверсії з обліковими записами та краще оптимізує ставки. Працює лише разом із конверсією вище.',
    merchantTitle: 'Google Merchant Center',
    merchantDesc:
      'Товарний фід для Google Shopping/Merchant Center. Додайте це посилання в Merchant Center (Продукти → Фіди → «Заданий час отримання»), воно оновлюється автоматично:',
    merchantLocaleNote: 'Для окремого фіда російською додайте ?locale=ru до посилання.',
    merchantCategoryLabel: 'Категорія товару Google (google_product_category)',
    merchantCategoryPlaceholder: 'Наприклад: Electronics > Communications > Telephony > Mobile Phones',
    merchantCategoryHint:
      'Без категорії Google часто обмежує покази або відхиляє товари в Shopping. Список категорій: google.com/basepages/producttype/taxonomy-with-ids.uk-UA.txt',
    merchantShippingPriceLabel: 'Фіксована вартість доставки у фіді',
    merchantShippingPricePlaceholder: 'Наприклад: 60 UAH',
    merchantShippingCountryLabel: 'Країна доставки (ISO, напр. UA)',
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
    cardVisitors: 'Унікальні відвідувачі',
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
    funnelVisitors: 'Унікальні відвідувачі',
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
  import: {
    pageTitle: 'Імпорт товарів',
    pageSubtitle: 'Завантажте CSV або XML файл із товарами. Підтримуються колонки: name_ru, name_uk, sku, price, old_price, quantity, description_ru, description_uk, unit — або ті самі дані з російськими заголовками з кнопки «Експорт» на сторінці товарів (Назва (рос), Артикул, Ціна, Залишок тощо). Роздільник ("," або ";") визначається автоматично. Товари з указаним артикулом (sku), який вже є в каталозі, будуть оновлені (ціна/залишок/назва/опис), а не задубльовані — товари без артикулу завжди створюються заново.',
    uploadCardTitle: 'Завантаження файлу',
    uploadCardDescription: 'CSV із заголовками або XML з елементами product / item / offer',
    chooseFileButton: 'Обрати файл',
    rowsBadgeTemplate: '{n} товарів',
    colName: 'Назва (RU)',
    colSku: 'Артикул',
    colPrice: 'Ціна',
    colQty: 'К-сть',
    showingFirstTemplate: 'Показані перші {shown} з {total} рядків',
    importButtonTemplate: 'Імпортувати {n} товарів',
    historyCardTitle: 'Історія імпорту',
    tableFile: 'Файл',
    tableType: 'Тип',
    tableStatus: 'Статус',
    tableTotal: 'Всього',
    tableSuccess: 'Успішно',
    tableFailed: 'Помилок',
    tableDate: 'Дата',
    noImportsYet: 'Імпортів ще не було',
    statusCompleted: 'Завершено',
    statusProcessing: 'Обробка',
    statusFailed: 'Помилка',
    statusPending: 'Очікування',
    promCardTitle: 'Імпорт з Prom.ua',
    promCardDescription: 'Вставте посилання на сторінку магазину на Prom.ua — всі товари, фото, описи та категорії будуть імпортовані у ваш каталог. Товари з артикулом, що вже існує, оновляться, а не задубляться.',
    promUrlPlaceholder: 'https://prom.ua/example.html',
    promStartButton: 'Почати імпорт',
    promContinueButton: 'Продовжити',
    promUnfinishedTitle: 'Незавершені імпорти з Prom.ua',
    promProcessedOfTotalTemplate: '{processed} з {total} товарів',
    promImportingSuffix: ' — триває імпорт, не закривайте сторінку',
    promDoneSuffix: ' — готово',
    promCompleteToast: 'Імпорт з Prom.ua завершено',
    errorParsingFile: 'Не вдалося розпізнати товари у файлі. Перевірте формат.',
    errorGeneric: 'Помилка імпорту',
    errorStart: 'Не вдалося почати імпорт',
    promFoundTemplate: 'Знайдено {total} товарів, починаю імпорт',
    promFoundCappedTemplate: 'Знайдено {shopTotal} товарів, будуть імпортовані перші {total}',
    importedResultTemplate: 'Імпортовано: {imported}, помилок: {failed}',
  },
  feedback: {
    pageTitle: 'Відгуки та запитання',
    pageSubtitle: 'Модерація зворотного зв\'язку щодо товарів',
    statReviews: 'Відгуки',
    statPending: 'На модерації',
    statQuestions: 'Запитання',
    statUnanswered: 'Без відповіді',
    tabReviews: 'Відгуки',
    tabQuestions: 'Запитання',
    filterAllTemplate: 'Всі ({n})',
    filterPendingReviewsTemplate: 'На модерації ({n})',
    filterApprovedTemplate: 'Схвалені ({n})',
    filterRejectedTemplate: 'Відхилені ({n})',
    filterUnansweredTemplate: 'Без відповіді ({n})',
    filterAnsweredTemplate: 'Відповідені ({n})',
    verifiedPurchase: 'Перевірена покупка',
    approveButton: 'Схвалити',
    rejectButton: 'Відхилити',
    deleteAria: 'Видалити',
    aboutProductPrefix: 'про товар:',
    helpfulSuffix: 'корисно',
    storeReplyLabel: 'Відповідь магазину',
    replyPlaceholder: 'Відповісти на відгук...',
    replyButton: 'Відповісти',
    answerPlaceholder: 'Написати відповідь...',
    answerButton: 'Відповісти',
    noReviews: 'Відгуків немає',
    noQuestions: 'Запитань немає',
    deleteReviewTitle: 'Видалити відгук?',
    deleteReviewDescription: 'Відгук буде видалено безповоротно.',
    deleteQuestionTitle: 'Видалити запитання?',
    deleteQuestionDescription: 'Запитання буде видалено безповоротно.',
    statusApproved: 'Схвалено',
    statusRejected: 'Відхилено',
    statusAnswered: 'Відповідь надано',
    statusPending: 'На модерації',
    ratingAriaTemplate: 'Оцінка {value} з 5',
    pageOfTemplate: 'Сторінка {page} з {total}',
    backButton: 'Назад',
    forwardButton: 'Вперед',
    toastReviewApproved: 'Відгук схвалено',
    toastReviewRejected: 'Відгук відхилено',
    toastReviewPending: 'Повернено на модерацію',
    toastReplySaved: 'Відповідь збережено',
    toastReviewDeleted: 'Відгук видалено',
    toastEnterAnswer: 'Введіть відповідь',
    toastAnswerPublished: 'Відповідь опубліковано',
    toastQuestionDeleted: 'Запитання видалено',
    toastGenericError: 'Помилка',
  },
  logs: {
    pageTitle: 'Логи',
    pageSubtitle: 'Журнал дій в адмін-центрі: входи, зміни товарів, замовлень і налаштувань',
    searchPlaceholder: 'Пошук за користувачем, email, деталями…',
    sectionPlaceholder: 'Розділ',
    allSections: 'Всі розділи',
    actionPlaceholder: 'Дія',
    allActions: 'Всі дії',
    refreshAria: 'Оновити',
    clearAria: 'Очистити логи',
    clearTitle: 'Очистити журнал?',
    clearDescription: 'Будуть видалені записи старші за 90 днів. Свіжі записи залишаться.',
    clearButton: 'Очистити',
    colDate: 'Дата',
    colUser: 'Користувач',
    colAction: 'Дія',
    colSection: 'Розділ',
    colDetails: 'Деталі',
    colIp: 'IP',
    noRecords: 'Записів поки немає. Дії адміністраторів будуть з\'являтись тут.',
    pageOfTotalTemplate: 'Стр. {page} з {total} · всього {count}',
    backButton: 'Назад',
    forwardButton: 'Вперед',
    actionLogin: 'Вхід',
    actionCreate: 'Створення',
    actionUpdate: 'Зміна',
    actionDelete: 'Видалення',
    actionToggle: 'Увімк/вимк',
    actionSettings: 'Налаштування',
    actionSecurity: 'Безпека',
    entityAuth: 'Авторизація',
    entityProduct: 'Товар',
    entityOrder: 'Замовлення',
    entityUser: 'Користувач',
    entitySettings: 'Налаштування',
    entityModalAd: 'Реклама',
    entityPromotion: 'Акція',
    entityCategory: 'Категорія',
    entityLogs: 'Логи',
    entityRole: 'Роль',
  },
  guides: {
    pageTitle: 'Інструкції',
    pageSubtitle: 'Покрокові гайди з налаштування та керування магазином через адмін-центр',
    searchPlaceholder: 'Пошук за інструкціями',
    tocAriaLabel: 'Зміст інструкцій',
    nothingFound: 'Нічого не знайдено',
    openSection: 'Відкрити розділ',
    noResultsPrefix: 'За запитом ',
    noResultsSuffix: ' нічого не знайдено. Спробуйте інше слово.',
  },
  abandonedCarts: {
    pageTitle: 'Покинуті кошики',
    pageSubtitle: 'Відвідувачі, які почали оформлення, але не завершили замовлення',
    refreshButton: 'Оновити',
    statOpen: 'Відкриті',
    statReminded: 'З нагадуванням',
    statRecovered: 'Повернулись і купили',
    statPotentialRevenue: 'Потенційний дохід',
    filterActive: 'Активні',
    filterRecovered: 'Відновлені',
    filterAll: 'Всі',
    emptyActive: 'Активних покинутих кошиків немає. Кошик потрапляє сюди, коли відвідувач ввів контакти на оформленні, але не завершив замовлення протягом 30 хвилин.',
    emptyGeneric: 'Список порожній',
    noName: 'Без імені',
    orderNumberPrefix: 'замовлення №',
    remindedAtPrefix: 'нагадування:',
    hideButton: 'Приховати',
    remindButton: 'Нагадати листом',
    remindNoEmailTitle: 'Немає email — зв\'яжіться телефоном',
    statusOpen: 'Не завершено',
    statusReminded: 'Нагадали',
    statusRecovered: 'Купив',
    itemQtyTemplate: '{qty} шт. × {price}',
    toastReminderSent: 'Нагадування надіслано',
    timeMinutesAgo: '{n} хв тому',
    timeHoursAgo: '{n} год тому',
    timeDaysAgo: '{n} дн тому',
  },
  notFound: {
    errorLabel: 'Помилка 404',
    title: 'Запис не знайдено',
    description: 'Такої сторінки або запису немає — можливо, її було видалено або посилання застаріло.',
    goToAdmin: 'До адмін-центру',
  },
  accessDenied: {
    errorLabel: 'Помилка 403',
    title: 'Доступ заборонено',
    reasonWithSection: 'Ваша роль не має доступу до розділу «{section}».',
    reasonGeneric: 'Ваша роль не має доступу до цього розділу.',
    contactHint:
      'Якщо доступ потрібен для роботи — зверніться до адміністратора магазину, щоб він видав дозвіл у розділі «Користувачі».',
    goToAdmin: 'До адмін-центру',
    goToSite: 'На сайт',
  },
  bestsellers: {
    title: 'Топ продажів',
    subtitle: 'Рейтинг товарів за продажами. Позначайте хіти для вітрини магазину.',
    statRankedItems: 'Позицій у рейтингу',
    statUnitsSold: 'Продано одиниць',
    statRevenue: 'Виручка',
    colRank: '#',
    colProduct: 'Товар',
    colUnitsSold: 'Продано',
    colOrders: 'Замовлень',
    colRevenue: 'Виручка',
    colTop: 'Топ продажів',
    topAria: 'Топ продажів',
    empty: 'Поки немає продажів для формування рейтингу',
    toastAdded: 'Додано в топ продажів',
    toastRemoved: 'Прибрано з топу',
    toastNoProduct: "Товар не пов'язаний з каталогом",
  },
  dashboard: {
    welcome: 'Ласкаво просимо, {name}',
    subtitle: 'Зведення по вашому магазину',
    statOrdersTotal: 'Замовлень всього',
    statOrdersActive: 'Активні замовлення',
    statRevenue: 'Виручка (оплачено)',
    statViews: 'Перегляди (30 дн.)',
    recentOrdersTitle: 'Останні замовлення',
    allOrders: 'Усі замовлення',
    noOrders: 'Замовлень поки немає',
    noName: 'Без імені',
    unitsSuffix: 'шт.',
    funnelTitle: 'Воронка (30 днів)',
    funnelPageViews: 'Перегляди сторінок',
    funnelProductViews: 'Перегляди товарів',
    funnelAddToCart: 'Додавання в кошик',
    funnelOrders: 'Замовлення',
    conversionRate: 'Конверсія в замовлення',
    lowStockTitle: 'Закінчуються на складі',
    toProducts: 'До товарів',
    skuLabel: 'Артикул',
    outOfStock: 'Немає в наявності',
    remainingPrefix: 'Залишилось',
  },
  pages: {
    title: 'Сторінки',
    subtitle: 'Інформаційні сторінки магазину',
    createPage: 'Створити сторінку',
    tabAll: 'Усі',
    tabPublished: 'Опубліковані',
    tabDraft: 'Чернетки',
    searchPlaceholder: 'Пошук за заголовком...',
    colTitle: 'Заголовок',
    colUrl: 'URL',
    colStatus: 'Статус',
    colInMenu: 'У меню',
    empty: 'Сторінок поки немає',
    yes: 'Так',
    published: 'Опубліковано',
    draft: 'Чернетка',
    actionsAria: 'Дії',
    edit: 'Редагувати',
    unpublish: 'Зняти з публікації',
    publish: 'Опублікувати',
    delete: 'Видалити',
    pageOf: 'Сторінка {page} з {total}',
    back: 'Назад',
    next: 'Далі',
    deleteTitle: 'Видалити сторінку?',
    deleteDescription: 'Сторінка «{title}» буде видалена безповоротно.',
    cancel: 'Скасувати',
    toastUnpublished: 'Сторінку знято з публікації',
    toastPublished: 'Сторінку опубліковано',
    toastDeleted: 'Сторінку видалено',
    dialogTitleEdit: 'Редагування сторінки',
    dialogTitleCreate: 'Нова сторінка',
    dialogDescription: 'Заповніть вміст і налаштування відображення.',
    tabContent: 'Вміст',
    tabSettings: 'Налаштування',
    tabSeo: 'SEO',
    titleUk: 'Заголовок (Укр)',
    titleRu: 'Заголовок (Рус)',
    titleUkPlaceholder: 'Наприклад: Про компанію',
    titleRuPlaceholder: 'Наприклад: О компании',
    slugLabel: 'URL (slug)',
    langUk: 'Українська',
    langRu: 'Русский',
    excerptUk: 'Короткий опис (Укр)',
    excerptRu: 'Короткий опис (Рус)',
    excerptPlaceholder: 'Короткий анонс сторінки',
    contentUk: 'Вміст, Укр (HTML)',
    contentRu: 'Вміст, Рус (HTML)',
    contentPlaceholder: '<h2>Заголовок</h2><p>Текст...</p>',
    templateLabel: 'Шаблон',
    templateDefault: 'Звичайна сторінка',
    templateContacts: 'Контакти',
    templateFaq: 'Питання-відповідь (FAQ)',
    templateLanding: 'Лендинг',
    publishLabel: 'Опублікувати',
    publishHint: 'Сторінка буде видима на сайті',
    showInMenuLabel: 'Показувати в меню',
    showInMenuHint: 'Додати посилання в навігацію',
    menuTitleLabel: 'Назва в меню',
    sortOrderLabel: 'Порядок',
    metaTitleLabel: 'Meta Title',
    metaTitlePlaceholder: 'Заголовок для пошукових систем',
    metaDescLabel: 'Meta Description',
    metaDescPlaceholder: 'Опис для сніпета в пошуку',
    save: 'Зберегти',
    saving: 'Збереження...',
    create: 'Створити',
    toastTitleRequired: 'Введіть заголовок сторінки',
    toastUpdated: 'Сторінку оновлено',
    toastCreated: 'Сторінку створено',
    toastSaveError: 'Помилка збереження',
  },
  users: {
    title: 'Користувачі та ролі',
    subtitle: 'Керування доступом співробітників до розділів адмін-центру',
    tabUsers: 'Користувачі',
    tabRoles: 'Ролі',
    addUser: 'Додати користувача',
    newUserTitle: 'Новий користувач',
    nameLabel: "Ім'я",
    emailLabel: 'Email',
    passwordLabel: 'Пароль',
    roleLabel: 'Роль',
    create: 'Створити',
    toastUserCreated: 'Користувача створено',
    genericError: 'Помилка',
    colUser: 'Користувач',
    colRole: 'Роль',
    colStatus: 'Статус',
    colActions: 'Дії',
    youSuffix: '(ви)',
    toastRoleUpdated: 'Роль оновлено',
    active: 'Активний',
    disabled: 'Відключений',
    deleteUserConfirm: 'Видалити користувача {name}?',
    toastUserDeleted: 'Користувача видалено',
    createRole: 'Створити роль',
    systemRole: 'Системна',
    customRole: 'Користувацька',
    accessCountLabel: 'Доступів:',
    allSections: 'всі розділи',
    edit: 'Змінити',
    deleteRoleConfirm: 'Видалити роль {name}?',
    toastRoleDeleted: 'Роль видалено',
    dialogTitleEdit: 'Редагування ролі',
    dialogTitleCreate: 'Нова роль',
    codeLabel: 'Код',
    descriptionLabel: 'Опис',
    adminRoleHint: 'Роль адміністратора завжди має повний доступ до всіх розділів.',
    sectionAccessLabel: 'Доступ до розділів',
    cancel: 'Скасувати',
    save: 'Зберегти',
    toastRoleSaved: 'Роль збережено',
  },
  articles: {
    title: 'Статті та блог',
    subtitle: 'Публікації магазину',
    newArticle: 'Нова стаття',
    tabAll: 'Усі',
    tabPublished: 'Опубліковані',
    tabDraft: 'Чернетки',
    categoryPlaceholder: 'Категорія',
    allCategories: 'Усі категорії',
    searchPlaceholder: 'Пошук статей...',
    empty: 'Статей поки немає',
    published: 'Опубліковано',
    draft: 'Чернетка',
    featuredBadge: 'Топ',
    actionsAria: 'Дії',
    edit: 'Редагувати',
    unpublish: 'Зняти з публікації',
    publish: 'Опублікувати',
    featuredAdd: 'У топ',
    featuredRemove: 'Прибрати з топу',
    delete: 'Видалити',
    minutesSuffix: 'хв',
    pageOf: 'Сторінка {page} з {total}',
    back: 'Назад',
    next: 'Далі',
    deleteTitle: 'Видалити статтю?',
    deleteDescription: 'Стаття «{title}» буде видалена безповоротно.',
    cancel: 'Скасувати',
    toastUnpublished: 'Знято з публікації',
    toastPublished: 'Опубліковано',
    toastFeaturedAdded: 'Додано в рекомендовані',
    toastFeaturedRemoved: 'Прибрано з рекомендованих',
    toastDeleted: 'Статтю видалено',
    dialogTitleEdit: 'Редагування статті',
    dialogTitleCreate: 'Нова стаття',
    dialogDescription: 'Напишіть матеріал і налаштуйте публікацію.',
    tabContent: 'Вміст',
    tabSettings: 'Налаштування',
    tabSeo: 'SEO',
    titleLabel: 'Заголовок',
    titlePlaceholder: 'Заголовок статті',
    slugLabel: 'URL (slug)',
    excerptLabel: 'Короткий опис',
    excerptPlaceholder: 'Анонс статті для картки і списків',
    contentLabel: 'Вміст (HTML)',
    contentPlaceholder: '<p>Текст статті...</p>',
    categoryLabel: 'Категорія',
    noCategory: 'Без категорії',
    authorLabel: 'Автор',
    coverLabel: 'Посилання на обкладинку',
    readingMinutesLabel: 'Час читання (хв)',
    tagsLabel: 'Теги',
    tagsPlaceholder: 'Додати тег і Enter',
    addTag: 'Додати',
    removeTagAria: 'Видалити тег',
    publishLabel: 'Опублікувати',
    publishHint: 'Стаття буде видима на сайті',
    featuredLabel: 'Рекомендована',
    featuredHint: 'Показувати в блоці «Топ»',
    metaTitleLabel: 'Meta Title',
    metaDescLabel: 'Meta Description',
    save: 'Зберегти',
    saving: 'Збереження...',
    create: 'Створити',
    toastTitleRequired: 'Введіть заголовок статті',
    toastUpdated: 'Статтю оновлено',
    toastCreated: 'Статтю створено',
    toastSaveError: 'Помилка збереження',
  },
  modalAds: {
    title: 'Модальна реклама',
    subtitle: 'Спливаючі банери на вітрині: акції, підписки, промо',
    newCampaign: 'Нова кампанія',
    statCampaigns: 'Кампаній',
    statViews: 'Покази',
    statClicks: 'Кліки',
    statCtr: 'CTR',
    searchPlaceholder: 'Пошук за назвою або заголовком…',
    tabAll: 'Усі',
    tabActive: 'Активні',
    tabInactive: 'Неактивні',
    empty: 'Кампаній поки немає',
    emptyHint: 'Створіть першу модальну рекламу — наприклад, попап зі знижкою для нових відвідувачів',
    createCampaign: 'Створити кампанію',
    active: 'Активна',
    inactive: 'Вимкнена',
    enableCampaignAria: 'Увімкнути кампанію',
    actionsAria: 'Дії',
    edit: 'Редагувати',
    resetStats: 'Скинути статистику',
    delete: 'Видалити',
    statViewsShort: 'Покази',
    statClicksShort: 'Кліки',
    statClosesShort: 'Закриття',
    paginationAria: 'Пагінація',
    secSuffix: 'сек',
    sinceLabel: 'з',
    untilLabel: 'по',
    dialogTitleEdit: 'Редагувати кампанію',
    dialogTitleCreate: 'Нова кампанія',
    dialogDescription: 'Налаштуйте вміст банера, умови показу і розклад',
    sectionContent: 'Вміст',
    campaignNameLabel: 'Назва кампанії',
    campaignNamePlaceholder: 'Знижка новим клієнтам',
    bannerTitleLabel: 'Заголовок банера',
    bannerTitlePlaceholder: '−10% на перше замовлення',
    textLabel: 'Текст',
    textPlaceholder: 'Підпишіться і отримайте промокод на знижку',
    bannerImageLabel: 'Зображення банера',
    bannerImageHint: 'Рекомендована пропорція 16:9. Стискається у WebP автоматично.',
    windowSizeLabel: 'Розмір вікна',
    sizeSmall: 'Маленький',
    sizeMedium: 'Середній',
    sizeLarge: 'Великий',
    buttonTextLabel: 'Текст кнопки',
    buttonTextPlaceholder: 'Перейти в каталог',
    buttonUrlLabel: 'Посилання кнопки',
    buttonColorLabel: 'Колір кнопки',
    colorTheme: 'Тема магазину',
    colorRed: 'Червоний',
    colorOrange: 'Оранжевий',
    colorGreen: 'Зелений',
    colorBlue: 'Синій',
    colorBlack: 'Чорний',
    customColorLabel: 'Свій колір',
    customColorAria: 'Свій колір кнопки',
    previewLabel: 'Перегляд:',
    sectionWhereToShow: 'Де показувати',
    pageAll: 'Усі сторінки',
    pageHome: 'Головна',
    pageCatalog: 'Каталог',
    pageProduct: 'Картка товару',
    pageCart: 'Кошик',
    sectionTrigger: 'Умова показу',
    triggerDelay: 'За затримкою',
    triggerDelayHint: 'Через N секунд після відкриття сторінки',
    triggerScroll: 'За прокруткою',
    triggerScrollHint: 'Коли відвідувач прокрутив N% сторінки',
    triggerExit: 'При виході',
    triggerExitHint: 'Коли курсор прямує до закриття вкладки',
    delaySecondsLabel: 'Затримка, сек',
    scrollPercentLabel: 'Прокрутка, %',
    sectionFrequency: 'Частота показу',
    freqEvery: 'Кожен візит',
    freqSession: 'Раз за сесію',
    freqDays: 'Раз на N днів',
    daysBetweenAria: 'Днів між показами',
    daysSuffix: 'днів',
    sectionSchedule: 'Розклад',
    startLabel: 'Початок',
    endLabel: 'Завершення (необов\u2019язково)',
    campaignEnabledLabel: 'Кампанію увімкнено',
    cancel: 'Скасувати',
    save: 'Зберегти',
    create: 'Створити',
    toastSaveError: 'Не вдалося зберегти',
    toastUpdated: 'Кампанію оновлено',
    toastCreated: 'Кампанію створено',
    toastDeleted: 'Кампанію видалено',
    toastStatsReset: 'Статистику скинуто',
    deleteTitle: 'Видалити кампанію?',
    deleteDescription: 'Кампанія та її статистика будуть видалені безповоротно.',
  },
  productAnalytics: {
    title: 'Аналітика товару',
    period: 'за 30 днів',
    views: 'Перегляди',
    addToCart: 'У кошик',
    unitsSold: 'Продано, шт',
    revenue: 'Виручка',
    cartRate: 'Конверсія в кошик',
    purchaseRate: 'Конверсія в замовлення',
  },
  productVariants: {
    axesTitle: 'Осі вибору',
    axesHint:
      'Додайте осі (наприклад «Розмір», або «Колір» + «Пам\u2019ять»). Значення вказуйте через кому. Потім натисніть «Згенерувати комбінації».',
    typeColor: 'колір',
    typeText: 'текст',
    removeAxisAria: 'Видалити вісь',
    valuesLabel: 'Значення (через кому)',
    colorPlaceholder: 'Black, Blue, Silver',
    textPlaceholder: '39, 40, 41, 42',
    colorForAria: 'Колір для',
    newAxisLabel: 'Нова вісь',
    newAxisPlaceholder: 'Колір',
    selectText: 'Текст',
    selectColor: 'Колір',
    addAxis: 'Додати вісь',
    generateMatrix: 'Згенерувати комбінації',
    combinationsTitle: 'Комбінації',
    combinationLabel: 'Комбінація',
    priceLabel: 'Ціна',
    oldPriceLabel: 'Стара ціна',
    quantityLabel: 'Залишок',
    skuLabel: 'SKU',
    variantImageLabel: 'Фото варіанту (для вибору кольору)',
  },
  productForm: {
    backToListAria: 'Назад до списку товарів',
    editTitle: 'Редагування товару',
    createTitle: 'Новий товар',
    idPrefix: 'ID',
    fillInfoHint: 'Заповніть інформацію про товар',
    cancel: 'Скасувати',
    save: 'Зберегти',
    createProduct: 'Створити товар',
    tabMain: 'Основне',
    tabPrice: 'Ціна та залишки',
    tabVariants: 'Варіанти',
    tabCategories: 'Категорії та групи',
    tabChars: 'Характеристики',
    tabSeo: 'SEO',
    photosTitle: 'Фотографії',
    mainPhotoLabel: 'Головне фото',
    mainPhotoHint: 'Відображається в каталозі і картці товару.',
    galleryLabel: 'Галерея товару',
    galleryHint: 'Додаткові фото товару. Можна завантажити декілька одразу.',
    nameSectionTitle: 'Назва і опис',
    nameRuLabel: 'Назва (RU)',
    nameRuPlaceholder: 'Бездротові навушники…',
    nameUkLabel: 'Назва (UK)',
    nameUkPlaceholder: 'Бездротові навушники…',
    descRuLabel: 'Опис (RU)',
    descUkLabel: 'Опис (UK)',
    notesLabel: 'Приватні нотатки (видно лише адміністраторам)',
    identificationTitle: 'Ідентифікація і статус',
    skuLabel: 'Артикул (SKU)',
    barcodeLabel: 'Штрихкод',
    salesTypeLabel: 'Тип продажів',
    salesTypeRetail: 'Роздріб',
    salesTypeWholesale: 'Опт',
    salesTypeBoth: 'Роздріб і опт',
    visibleLabel: 'Показувати на сайті',
    visibleHint: 'Товар видно покупцям',
    popularLabel: 'Популярний товар',
    popularHint: 'Показується в блоці «Популярні товари»',
    purchaseCounterTitle: 'Лічильник покупок',
    realOrdersLabel: 'Реальні покупки',
    realOrdersHint: 'Рахується автоматично за замовленнями',
    purchasesBoostLabel: 'Накрутка покупок',
    purchasesBoostHint: 'Додається до реальної кількості покупок',
    shownToBuyersLabel: 'Показується покупцям',
    shownToBuyersHint: '«Купили N разів» на картці товару',
    dimensionsTitle: 'Габарити і вага',
    widthLabel: 'Ширина, см',
    heightLabel: 'Висота, см',
    lengthLabel: 'Довжина, см',
    weightLabel: 'Вага, кг',
    pricesTitle: 'Ціни',
    priceLabel: 'Ціна продажу *',
    oldPriceLabel: 'Стара ціна (для знижки)',
    costPriceLabel: 'Ціна закупівлі',
    currencyLabel: 'Валюта',
    priceFromLabel: 'Ціна «від»',
    priceFromHint: 'Відображати як мінімальну ціну',
    stockTitle: 'Наявність',
    quantityLabel: 'Кількість на складі',
    quantityHint: 'При нулі статус автоматично стане «Немає в наявності»',
    quantityHintVariants: 'Сума залишків усіх комбінацій на вкладці «Варіанти»',
    unitLabel: 'Одиниця виміру',
    variantsActiveNotice:
      'Увімкнено варіанти товару — ціна та залишок нижче розраховуються автоматично за вкладкою «Варіанти» (мінімальна ціна серед комбінацій, сумарний залишок) і недоступні для ручного редагування. Щоб задавати їх вручну тут, вимкніть варіанти на вкладці «Варіанти».',
    variantsToggleLabel: 'Увімкнути варіанти товару',
    variantsToggleHint:
      'Вибір за кольором, розміром тощо. Поки вимкнено — покупець бачить один товар з ціною та залишком з вкладки «Ціна та залишки»; нижче налаштовані комбінації не застосовуються (і дані не втрачаються).',
    variantsOffHint:
      'Увімкніть перемикач вище, щоб налаштувати осі вибору (колір, розмір тощо) і ціну/залишок для кожної комбінації.',
    productCategoriesTitle: 'Категорії товару',
    noCategoriesHint: 'Категорій поки немає.',
    createCategoryLink: 'Створити категорію',
    productGroupsTitle: 'Групи товарів',
    noGroupsHint: 'Груп поки немає.',
    createGroupLink: 'Створити групу',
    placementTitle: 'Розміщення',
    siteGroupLabel: 'Група на сайті',
    notSelected: 'Не обрано',
    marketplaceCategoryLabel: 'Категорія маркетплейсу',
    charsTitle: 'Характеристики товару',
    charsEmptyHint: 'Характеристики не додані. Наприклад: «Колір — чорний», «Матеріал — метал».',
    charNamePlaceholder: 'Назва (Колір)',
    charNameAria: 'Назва характеристики',
    charValuePlaceholder: 'Значення (Чорний)',
    charValueAria: 'Значення характеристики',
    removeCharAria: 'Видалити характеристику',
    addChar: 'Додати характеристику',
    seoTitle: 'SEO-налаштування',
    metaTitleRuLabel: 'Meta Title (RU)',
    metaTitleUkLabel: 'Meta Title (UK)',
    metaDescRuLabel: 'Meta Description (RU)',
    metaDescUkLabel: 'Meta Description (UK)',
    toastNameRequired: 'Вкажіть назву товару хоча б однією мовою',
    toastPriceInvalid: 'Вкажіть коректну ціну',
    toastUpdated: 'Товар оновлено',
    toastCreated: 'Товар створено',
    toastSaveError: 'Помилка збереження',
    saveChanges: 'Зберегти зміни',
  },
  auditLog: {
    cartReminderSent: 'Надіслано нагадування на {{email}}',
    cartsHidden: 'Приховано кошиків: {{count}}',
    logsClearedOld: 'Очищення логів старіших за {{days}} дн. ({{count}})',
    logsClearedAll: 'Повне очищення логів ({{count}})',
    campaignCreated: 'Створено кампанію «{{name}}»',
    campaignUpdated: 'Змінено кампанію «{{name}}»',
    campaignEnabled: 'Кампанію увімкнено',
    campaignDisabled: 'Кампанію вимкнено',
    campaignDeleted: 'Кампанію видалено',
    orderStatusChanged: 'Статус замовлення: «{{label}}»',
    orderCreated: 'Замовлення створено (№{{number}})',
    paymentStatusChanged: 'Оплата: {{label}}',
    trackingCreated: 'Створено ЕН {{number}}',
    productCreated: 'Створено товар «{{name}}»',
    productUpdated: 'Змінено товар «{{name}}»',
    productsTrashed: 'Товари переміщено в кошик: {{ids}}',
    settingsUpdated: 'Оновлено налаштування: {{keys}}',
    settingsUnchanged: 'Налаштування збережено (без змін)',
    cacheCleared: 'Очищено кеш сайту',
    userCreated: 'Створено користувача {{email}} (роль: {{role}})',
    userRoleChanged: 'Зміна ролі користувача на «{{role}}»',
    userActivated: 'Користувача активовано',
    userDeactivated: 'Користувача деактивовано',
    userDeleted: 'Користувача видалено',
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
    trafficSource: 'Источник трафика',
    utmCampaign: 'Кампания',
    utmMedium: 'Канал',
    utmTerm: 'Ключевое слово',
    utmContent: 'Контент объявления',
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
  groups: {
    title: 'Группы товаров',
    subtitle: 'Подборки товаров для витрин и акций',
    countOne: 'группа',
    countFew: 'группы',
    countMany: 'групп',
    addGroup: 'Добавить группу',
    colName: 'Название',
    colSlug: 'Slug',
    colProducts: 'Товаров',
    colSortOrder: 'Порядок',
    colStatus: 'Статус',
    colActions: 'Действия',
    notFound: 'Групп пока нет',
    deactivateAria: 'Деактивировать группу',
    activateAria: 'Активировать группу',
    active: 'Активна',
    inactive: 'Неактивна',
    editAria: 'Редактировать',
    deleteAria: 'Удалить',
    editTitle: 'Редактировать группу',
    newTitle: 'Новая группа',
    dialogHint: 'Группы объединяют товары в подборки: «Хиты продаж», «Новинки» и т.д.',
    nameRu: 'Название (RU) *',
    nameUk: 'Название (UK) *',
    descriptionRu: 'Описание (RU)',
    sortOrder: 'Порядок сортировки',
    isActive: 'Активна',
    cancel: 'Отмена',
    save: 'Сохранить',
    create: 'Создать',
    deleteTitle: 'Удалить группу?',
    deleteDescription: 'будет удалена. Товары останутся, но связи с группой будут удалены.',
    delete: 'Удалить',
    toastFillBothLanguages: 'Заполните название на обоих языках',
    toastUpdated: 'Группа обновлена',
    toastCreated: 'Группа создана',
    toastSaveError: 'Ошибка сохранения',
    toastDeleted: 'Группа удалена',
    toastDeleteError: 'Ошибка удаления',
  },
  trash: {
    title: 'Корзина',
    subtitle: 'Удалённые товары. Их можно восстановить или удалить навсегда.',
    restore: 'Восстановить',
    deleteForever: 'Удалить навсегда',
    deleteSelectedTitle: 'Удалить выбранные товары навсегда?',
    deleteSelectedDescription: 'Это действие необратимо. Товары и все связанные данные будут удалены из базы.',
    cancel: 'Отмена',
    emptyTrash: 'Очистить корзину',
    emptyTrashTitle: 'Очистить корзину полностью?',
    emptyTrashDescription: 'будут удалены безвозвратно.',
    itemOne: 'товар',
    itemFew: 'товара',
    itemMany: 'товаров',
    empty: 'Корзина пуста',
    selectAllAria: 'Выбрать все',
    selectRowAria: 'Выбрать',
    colName: 'Название',
    colSku: 'Артикул',
    colPrice: 'Цена',
    colQuantity: 'Кол-во',
    colDeletedAt: 'Удалён',
    colActions: 'Действия',
    noName: 'Без названия',
    restoreAria: 'Восстановить',
    deleteForeverAria: 'Удалить навсегда',
    toastRestored: 'Восстановлено товаров',
    toastRestoreError: 'Ошибка восстановления',
    toastDeletedForever: 'Удалено навсегда',
    toastDeleteError: 'Ошибка удаления',
    toastEmptied: 'Корзина очищена',
    toastEmptyError: 'Ошибка очистки корзины',
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
    minOrderTitle: 'Минимальная сумма заказа',
    minOrderDesc: 'Запретить оформление заказа, если сумма товаров меньше порога',
    minOrderAmountLabel: 'Минимальная сумма, ₴',
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
    ogImageLabel: 'Картинка для ссылки (Open Graph)',
    ogImageHint:
      'Показывается в превью, когда ссылку на сайт отправляют в Telegram, Viber, Instagram, Slack и т.п. (1200×630). Если не загружено — используется картинка по умолчанию.',
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
    enhancedConvTitle: 'Enhanced Conversions',
    enhancedConvDesc:
      'Отправляет захешированный email/телефон покупателя вместе с конверсией покупки — Google точнее сопоставляет конверсии с аккаунтами и лучше оптимизирует ставки. Работает только вместе с конверсией выше.',
    merchantTitle: 'Google Merchant Center',
    merchantDesc:
      'Товарный фид для Google Shopping/Merchant Center. Добавьте эту ссылку в Merchant Center (Продукты → Фиды → «Заданное время получения»), она обновляется автоматически:',
    merchantLocaleNote: 'Для отдельного фида на русском добавьте ?locale=ru к ссылке.',
    merchantCategoryLabel: 'Категория товара Google (google_product_category)',
    merchantCategoryPlaceholder: 'Например: Electronics > Communications > Telephony > Mobile Phones',
    merchantCategoryHint:
      'Без категории Google часто ограничивает показы или отклоняет товары в Shopping. Список категорий: google.com/basepages/producttype/taxonomy-with-ids.ru-RU.txt',
    merchantShippingPriceLabel: 'Фиксированная стоимость доставки в фиде',
    merchantShippingPricePlaceholder: 'Например: 60 UAH',
    merchantShippingCountryLabel: 'Страна доставки (ISO, напр. UA)',
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
    cardVisitors: 'Уникальные посетители',
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
    funnelVisitors: 'Уникальные посетители',
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
  import: {
    pageTitle: 'Импорт товаров',
    pageSubtitle: 'Загрузите CSV или XML файл с товарами. Поддерживаются колонки: name_ru, name_uk, sku, price, old_price, quantity, description_ru, description_uk, unit — либо те же данные с русскими заголовками из кнопки «Экспорт» на странице товаров (Название (рус), Артикул, Цена, Остаток и т.д.). Разделитель ("," или ";") определяется автоматически. Товары с указанным артикулом (sku), который уже есть в каталоге, будут обновлены (цена/остаток/название/описание), а не задублированы — товары без артикула всегда создаются заново.',
    uploadCardTitle: 'Загрузка файла',
    uploadCardDescription: 'CSV с заголовками или XML с элементами product / item / offer',
    chooseFileButton: 'Выбрать файл',
    rowsBadgeTemplate: '{n} товаров',
    colName: 'Название (RU)',
    colSku: 'Артикул',
    colPrice: 'Цена',
    colQty: 'Кол-во',
    showingFirstTemplate: 'Показаны первые {shown} из {total} строк',
    importButtonTemplate: 'Импортировать {n} товаров',
    historyCardTitle: 'История импорта',
    tableFile: 'Файл',
    tableType: 'Тип',
    tableStatus: 'Статус',
    tableTotal: 'Всего',
    tableSuccess: 'Успешно',
    tableFailed: 'Ошибок',
    tableDate: 'Дата',
    noImportsYet: 'Импортов ещё не было',
    statusCompleted: 'Завершён',
    statusProcessing: 'Обработка',
    statusFailed: 'Ошибка',
    statusPending: 'Ожидание',
    promCardTitle: 'Импорт с Prom.ua',
    promCardDescription: 'Вставьте ссылку на страницу магазина на Prom.ua — все товары, фото, описания и категории будут импортированы в ваш каталог. Товары с уже существующим артикулом обновятся, а не задублируются.',
    promUrlPlaceholder: 'https://prom.ua/example.html',
    promStartButton: 'Начать импорт',
    promContinueButton: 'Продолжить',
    promUnfinishedTitle: 'Незавершённые импорты с Prom.ua',
    promProcessedOfTotalTemplate: '{processed} из {total} товаров',
    promImportingSuffix: ' — идёт импорт, не закрывайте страницу',
    promDoneSuffix: ' — готово',
    promCompleteToast: 'Импорт с Prom.ua завершён',
    errorParsingFile: 'Не удалось распознать товары в файле. Проверьте формат.',
    errorGeneric: 'Ошибка импорта',
    errorStart: 'Не удалось начать импорт',
    promFoundTemplate: 'Найдено {total} товаров, начинаю импорт',
    promFoundCappedTemplate: 'Найдено {shopTotal} товаров, будут импортированы первые {total}',
    importedResultTemplate: 'Импортировано: {imported}, ошибок: {failed}',
  },
  feedback: {
    pageTitle: 'Отзывы и вопросы',
    pageSubtitle: 'Модерация обратной связи по товарам',
    statReviews: 'Отзывы',
    statPending: 'На модерации',
    statQuestions: 'Вопросы',
    statUnanswered: 'Без ответа',
    tabReviews: 'Отзывы',
    tabQuestions: 'Вопросы',
    filterAllTemplate: 'Все ({n})',
    filterPendingReviewsTemplate: 'На модерации ({n})',
    filterApprovedTemplate: 'Одобренные ({n})',
    filterRejectedTemplate: 'Отклонённые ({n})',
    filterUnansweredTemplate: 'Без ответа ({n})',
    filterAnsweredTemplate: 'Отвеченные ({n})',
    verifiedPurchase: 'Проверенная покупка',
    approveButton: 'Одобрить',
    rejectButton: 'Отклонить',
    deleteAria: 'Удалить',
    aboutProductPrefix: 'о товаре:',
    helpfulSuffix: 'полезно',
    storeReplyLabel: 'Ответ магазина',
    replyPlaceholder: 'Ответить на отзыв...',
    replyButton: 'Ответить',
    answerPlaceholder: 'Написать ответ...',
    answerButton: 'Ответить',
    noReviews: 'Отзывов нет',
    noQuestions: 'Вопросов нет',
    deleteReviewTitle: 'Удалить отзыв?',
    deleteReviewDescription: 'Отзыв будет удалён безвозвратно.',
    deleteQuestionTitle: 'Удалить вопрос?',
    deleteQuestionDescription: 'Вопрос будет удалён безвозвратно.',
    statusApproved: 'Одобрен',
    statusRejected: 'Отклонён',
    statusAnswered: 'Отвечен',
    statusPending: 'На модерации',
    ratingAriaTemplate: 'Оценка {value} из 5',
    pageOfTemplate: 'Страница {page} из {total}',
    backButton: 'Назад',
    forwardButton: 'Вперёд',
    toastReviewApproved: 'Отзыв одобрен',
    toastReviewRejected: 'Отзыв отклонён',
    toastReviewPending: 'Возвращён на модерацию',
    toastReplySaved: 'Ответ сохранён',
    toastReviewDeleted: 'Отзыв удалён',
    toastEnterAnswer: 'Введите ответ',
    toastAnswerPublished: 'Ответ опубликован',
    toastQuestionDeleted: 'Вопрос удалён',
    toastGenericError: 'Ошибка',
  },
  logs: {
    pageTitle: 'Логи',
    pageSubtitle: 'Журнал действий в админ-центре: входы, изменения товаров, заказов и настроек',
    searchPlaceholder: 'Поиск по пользователю, email, деталям…',
    sectionPlaceholder: 'Раздел',
    allSections: 'Все разделы',
    actionPlaceholder: 'Действие',
    allActions: 'Все действия',
    refreshAria: 'Обновить',
    clearAria: 'Очистить логи',
    clearTitle: 'Очистить журнал?',
    clearDescription: 'Будут удалены записи старше 90 дней. Свежие записи останутся.',
    clearButton: 'Очистить',
    colDate: 'Дата',
    colUser: 'Пользователь',
    colAction: 'Действие',
    colSection: 'Раздел',
    colDetails: 'Детали',
    colIp: 'IP',
    noRecords: 'Записей пока нет. Действия администраторов будут появляться здесь.',
    pageOfTotalTemplate: 'Стр. {page} из {total} · всего {count}',
    backButton: 'Назад',
    forwardButton: 'Вперёд',
    actionLogin: 'Вход',
    actionCreate: 'Создание',
    actionUpdate: 'Изменение',
    actionDelete: 'Удаление',
    actionToggle: 'Вкл/выкл',
    actionSettings: 'Настройки',
    actionSecurity: 'Безопасность',
    entityAuth: 'Авторизация',
    entityProduct: 'Товар',
    entityOrder: 'Заказ',
    entityUser: 'Пользователь',
    entitySettings: 'Настройки',
    entityModalAd: 'Реклама',
    entityPromotion: 'Акция',
    entityCategory: 'Категория',
    entityLogs: 'Логи',
    entityRole: 'Роль',
  },
  guides: {
    pageTitle: 'Инструкции',
    pageSubtitle: 'Пошаговые гайды по настройке и управлению магазином через админ-центр',
    searchPlaceholder: 'Поиск по инструкциям',
    tocAriaLabel: 'Оглавление инструкций',
    nothingFound: 'Ничего не найдено',
    openSection: 'Открыть раздел',
    noResultsPrefix: 'По запросу ',
    noResultsSuffix: ' ничего не найдено. Попробуйте другое слово.',
  },
  abandonedCarts: {
    pageTitle: 'Брошенные корзины',
    pageSubtitle: 'Посетители, которые начали оформление, но не завершили заказ',
    refreshButton: 'Обновить',
    statOpen: 'Открытые',
    statReminded: 'С напоминанием',
    statRecovered: 'Вернулись и купили',
    statPotentialRevenue: 'Потенциальная выручка',
    filterActive: 'Активные',
    filterRecovered: 'Восстановленные',
    filterAll: 'Все',
    emptyActive: 'Активных брошенных корзин нет. Корзина попадает сюда, когда посетитель ввёл контакты на оформлении, но не завершил заказ в течение 30 минут.',
    emptyGeneric: 'Список пуст',
    noName: 'Без имени',
    orderNumberPrefix: 'заказ №',
    remindedAtPrefix: 'напоминание:',
    hideButton: 'Скрыть',
    remindButton: 'Напомнить письмом',
    remindNoEmailTitle: 'Нет email — свяжитесь по телефону',
    statusOpen: 'Не завершена',
    statusReminded: 'Напомнили',
    statusRecovered: 'Купил',
    itemQtyTemplate: '{qty} шт. × {price}',
    toastReminderSent: 'Напоминание отправлено',
    timeMinutesAgo: '{n} мин назад',
    timeHoursAgo: '{n} ч назад',
    timeDaysAgo: '{n} дн назад',
  },
  notFound: {
    errorLabel: 'Ошибка 404',
    title: 'Запись не найдена',
    description: 'Такой страницы или записи нет — возможно, она была удалена или ссылка устарела.',
    goToAdmin: 'В админ-центр',
  },
  accessDenied: {
    errorLabel: 'Ошибка 403',
    title: 'Доступ запрещён',
    reasonWithSection: 'У вашей роли нет доступа к разделу «{section}».',
    reasonGeneric: 'У вашей роли нет доступа к этому разделу.',
    contactHint:
      'Если доступ нужен для работы — обратитесь к администратору магазина, чтобы он выдал разрешение в разделе «Пользователи».',
    goToAdmin: 'В админ-центр',
    goToSite: 'На сайт',
  },
  bestsellers: {
    title: 'Топ продаж',
    subtitle: 'Рейтинг товаров по продажам. Отмечайте хиты для витрины магазина.',
    statRankedItems: 'Позиций в рейтинге',
    statUnitsSold: 'Продано единиц',
    statRevenue: 'Выручка',
    colRank: '#',
    colProduct: 'Товар',
    colUnitsSold: 'Продано',
    colOrders: 'Заказов',
    colRevenue: 'Выручка',
    colTop: 'Топ продаж',
    topAria: 'Топ продаж',
    empty: 'Пока нет продаж для формирования рейтинга',
    toastAdded: 'Добавлено в топ продаж',
    toastRemoved: 'Убрано из топа',
    toastNoProduct: 'Товар не связан с каталогом',
  },
  dashboard: {
    welcome: 'Добро пожаловать, {name}',
    subtitle: 'Сводка по вашему магазину',
    statOrdersTotal: 'Заказов всего',
    statOrdersActive: 'Активные заказы',
    statRevenue: 'Выручка (оплачено)',
    statViews: 'Просмотры (30 дн.)',
    recentOrdersTitle: 'Последние заказы',
    allOrders: 'Все заказы',
    noOrders: 'Заказов пока нет',
    noName: 'Без имени',
    unitsSuffix: 'шт.',
    funnelTitle: 'Воронка (30 дней)',
    funnelPageViews: 'Просмотры страниц',
    funnelProductViews: 'Просмотры товаров',
    funnelAddToCart: 'Добавления в корзину',
    funnelOrders: 'Заказы',
    conversionRate: 'Конверсия в заказ',
    lowStockTitle: 'Заканчиваются на складе',
    toProducts: 'К товарам',
    skuLabel: 'Артикул',
    outOfStock: 'Нет в наличии',
    remainingPrefix: 'Осталось',
  },
  pages: {
    title: 'Страницы',
    subtitle: 'Информационные страницы магазина',
    createPage: 'Создать страницу',
    tabAll: 'Все',
    tabPublished: 'Опубликованные',
    tabDraft: 'Черновики',
    searchPlaceholder: 'Поиск по заголовку...',
    colTitle: 'Заголовок',
    colUrl: 'URL',
    colStatus: 'Статус',
    colInMenu: 'В меню',
    empty: 'Страниц пока нет',
    yes: 'Да',
    published: 'Опубликовано',
    draft: 'Черновик',
    actionsAria: 'Действия',
    edit: 'Редактировать',
    unpublish: 'Снять с публикации',
    publish: 'Опубликовать',
    delete: 'Удалить',
    pageOf: 'Страница {page} из {total}',
    back: 'Назад',
    next: 'Вперёд',
    deleteTitle: 'Удалить страницу?',
    deleteDescription: 'Страница «{title}» будет удалена безвозвратно.',
    cancel: 'Отмена',
    toastUnpublished: 'Страница снята с публикации',
    toastPublished: 'Страница опубликована',
    toastDeleted: 'Страница удалена',
    dialogTitleEdit: 'Редактирование страницы',
    dialogTitleCreate: 'Новая страница',
    dialogDescription: 'Заполните содержимое и настройки отображения.',
    tabContent: 'Содержимое',
    tabSettings: 'Настройки',
    tabSeo: 'SEO',
    titleUk: 'Заголовок (Укр)',
    titleRu: 'Заголовок (Рус)',
    titleUkPlaceholder: 'Наприклад: Про компанію',
    titleRuPlaceholder: 'Например: О компании',
    slugLabel: 'URL (slug)',
    langUk: 'Українська',
    langRu: 'Русский',
    excerptUk: 'Краткое описание (Укр)',
    excerptRu: 'Краткое описание (Рус)',
    excerptPlaceholder: 'Короткий анонс страницы',
    contentUk: 'Содержимое, Укр (HTML)',
    contentRu: 'Содержимое, Рус (HTML)',
    contentPlaceholder: '<h2>Заголовок</h2><p>Текст...</p>',
    templateLabel: 'Шаблон',
    templateDefault: 'Обычная страница',
    templateContacts: 'Контакты',
    templateFaq: 'Вопрос-ответ (FAQ)',
    templateLanding: 'Лендинг',
    publishLabel: 'Опубликовать',
    publishHint: 'Страница будет видна на сайте',
    showInMenuLabel: 'Показывать в меню',
    showInMenuHint: 'Добавить ссылку в навигацию',
    menuTitleLabel: 'Название в меню',
    sortOrderLabel: 'Порядок',
    metaTitleLabel: 'Meta Title',
    metaTitlePlaceholder: 'Заголовок для поисковых систем',
    metaDescLabel: 'Meta Description',
    metaDescPlaceholder: 'Описание для сниппета в поиске',
    save: 'Сохранить',
    saving: 'Сохранение...',
    create: 'Создать',
    toastTitleRequired: 'Введите заголовок страницы',
    toastUpdated: 'Страница обновлена',
    toastCreated: 'Страница создана',
    toastSaveError: 'Ошибка сохранения',
  },
  users: {
    title: 'Пользователи и роли',
    subtitle: 'Управление доступом сотрудников к разделам админ-центра',
    tabUsers: 'Пользователи',
    tabRoles: 'Роли',
    addUser: 'Добавить пользователя',
    newUserTitle: 'Новый пользователь',
    nameLabel: 'Имя',
    emailLabel: 'Email',
    passwordLabel: 'Пароль',
    roleLabel: 'Роль',
    create: 'Создать',
    toastUserCreated: 'Пользователь создан',
    genericError: 'Ошибка',
    colUser: 'Пользователь',
    colRole: 'Роль',
    colStatus: 'Статус',
    colActions: 'Действия',
    youSuffix: '(вы)',
    toastRoleUpdated: 'Роль обновлена',
    active: 'Активен',
    disabled: 'Отключён',
    deleteUserConfirm: 'Удалить пользователя {name}?',
    toastUserDeleted: 'Пользователь удалён',
    createRole: 'Создать роль',
    systemRole: 'Системная',
    customRole: 'Пользовательская',
    accessCountLabel: 'Доступов:',
    allSections: 'все разделы',
    edit: 'Изменить',
    deleteRoleConfirm: 'Удалить роль {name}?',
    toastRoleDeleted: 'Роль удалена',
    dialogTitleEdit: 'Редактирование роли',
    dialogTitleCreate: 'Новая роль',
    codeLabel: 'Код',
    descriptionLabel: 'Описание',
    adminRoleHint: 'Роль администратора всегда имеет полный доступ ко всем разделам.',
    sectionAccessLabel: 'Доступ к разделам',
    cancel: 'Отмена',
    save: 'Сохранить',
    toastRoleSaved: 'Роль сохранена',
  },
  articles: {
    title: 'Статьи и блог',
    subtitle: 'Публикации магазина',
    newArticle: 'Новая статья',
    tabAll: 'Все',
    tabPublished: 'Опубликованные',
    tabDraft: 'Черновики',
    categoryPlaceholder: 'Категория',
    allCategories: 'Все категории',
    searchPlaceholder: 'Поиск статей...',
    empty: 'Статей пока нет',
    published: 'Опубликовано',
    draft: 'Черновик',
    featuredBadge: 'Топ',
    actionsAria: 'Действия',
    edit: 'Редактировать',
    unpublish: 'Снять с публикации',
    publish: 'Опубликовать',
    featuredAdd: 'В топ',
    featuredRemove: 'Убрать из топа',
    delete: 'Удалить',
    minutesSuffix: 'мин',
    pageOf: 'Страница {page} из {total}',
    back: 'Назад',
    next: 'Вперёд',
    deleteTitle: 'Удалить статью?',
    deleteDescription: 'Статья «{title}» будет удалена безвозвратно.',
    cancel: 'Отмена',
    toastUnpublished: 'Снято с публикации',
    toastPublished: 'Опубликовано',
    toastFeaturedAdded: 'Добавлено в рекомендованные',
    toastFeaturedRemoved: 'Убрано из рекомендованных',
    toastDeleted: 'Статья удалена',
    dialogTitleEdit: 'Редактирование статьи',
    dialogTitleCreate: 'Новая статья',
    dialogDescription: 'Напишите материал и настройте публикацию.',
    tabContent: 'Содержимое',
    tabSettings: 'Настройки',
    tabSeo: 'SEO',
    titleLabel: 'Заголовок',
    titlePlaceholder: 'Заголовок статьи',
    slugLabel: 'URL (slug)',
    excerptLabel: 'Краткое описание',
    excerptPlaceholder: 'Анонс статьи для карточки и списков',
    contentLabel: 'Содержимое (HTML)',
    contentPlaceholder: '<p>Текст статьи...</p>',
    categoryLabel: 'Категория',
    noCategory: 'Без категории',
    authorLabel: 'Автор',
    coverLabel: 'Ссылка на обложку',
    readingMinutesLabel: 'Время чтения (мин)',
    tagsLabel: 'Теги',
    tagsPlaceholder: 'Добавить тег и Enter',
    addTag: 'Добавить',
    removeTagAria: 'Удалить тег',
    publishLabel: 'Опубликовать',
    publishHint: 'Статья будет видна на сайте',
    featuredLabel: 'Рекомендованная',
    featuredHint: 'Показывать в блоке «Топ»',
    metaTitleLabel: 'Meta Title',
    metaDescLabel: 'Meta Description',
    save: 'Сохранить',
    saving: 'Сохранение...',
    create: 'Создать',
    toastTitleRequired: 'Введите заголовок статьи',
    toastUpdated: 'Статья обновлена',
    toastCreated: 'Статья создана',
    toastSaveError: 'Ошибка сохранения',
  },
  modalAds: {
    title: 'Модальная реклама',
    subtitle: 'Всплывающие баннеры на витрине: акции, подписки, промо',
    newCampaign: 'Новая кампания',
    statCampaigns: 'Кампаний',
    statViews: 'Показы',
    statClicks: 'Клики',
    statCtr: 'CTR',
    searchPlaceholder: 'Поиск по названию или заголовку…',
    tabAll: 'Все',
    tabActive: 'Активные',
    tabInactive: 'Неактивные',
    empty: 'Кампаний пока нет',
    emptyHint: 'Создайте первую модальную рекламу — например, попап со скидкой для новых посетителей',
    createCampaign: 'Создать кампанию',
    active: 'Активна',
    inactive: 'Выключена',
    enableCampaignAria: 'Включить кампанию',
    actionsAria: 'Действия',
    edit: 'Редактировать',
    resetStats: 'Сбросить статистику',
    delete: 'Удалить',
    statViewsShort: 'Показы',
    statClicksShort: 'Клики',
    statClosesShort: 'Закрытия',
    paginationAria: 'Пагинация',
    secSuffix: 'сек',
    sinceLabel: 'с',
    untilLabel: 'по',
    dialogTitleEdit: 'Редактировать кампанию',
    dialogTitleCreate: 'Новая кампания',
    dialogDescription: 'Настройте содержимое баннера, условия показа и расписание',
    sectionContent: 'Содержимое',
    campaignNameLabel: 'Название кампании',
    campaignNamePlaceholder: 'Скидка новым клиентам',
    bannerTitleLabel: 'Заголовок баннера',
    bannerTitlePlaceholder: '−10% на первый заказ',
    textLabel: 'Текст',
    textPlaceholder: 'Подпишитесь и получите промокод на скидку',
    bannerImageLabel: 'Изображение баннера',
    bannerImageHint: 'Рекомендуемая пропорция 16:9. Сжимается в WebP автоматически.',
    windowSizeLabel: 'Размер окна',
    sizeSmall: 'Маленький',
    sizeMedium: 'Средний',
    sizeLarge: 'Большой',
    buttonTextLabel: 'Текст кнопки',
    buttonTextPlaceholder: 'Перейти в каталог',
    buttonUrlLabel: 'Ссылка кнопки',
    buttonColorLabel: 'Цвет кнопки',
    colorTheme: 'Тема магазина',
    colorRed: 'Красный',
    colorOrange: 'Оранжевый',
    colorGreen: 'Зелёный',
    colorBlue: 'Синий',
    colorBlack: 'Чёрный',
    customColorLabel: 'Свой цвет',
    customColorAria: 'Свой цвет кнопки',
    previewLabel: 'Превью:',
    sectionWhereToShow: 'Где показывать',
    pageAll: 'Все страницы',
    pageHome: 'Главная',
    pageCatalog: 'Каталог',
    pageProduct: 'Карточка товара',
    pageCart: 'Корзина',
    sectionTrigger: 'Условие показа',
    triggerDelay: 'По задержке',
    triggerDelayHint: 'Через N секунд после открытия страницы',
    triggerScroll: 'По прокрутке',
    triggerScrollHint: 'Когда посетитель прокрутил N% страницы',
    triggerExit: 'При уходе',
    triggerExitHint: 'Когда курсор уходит к закрытию вкладки',
    delaySecondsLabel: 'Задержка, сек',
    scrollPercentLabel: 'Прокрутка, %',
    sectionFrequency: 'Частота показа',
    freqEvery: 'Каждый визит',
    freqSession: 'Раз за сессию',
    freqDays: 'Раз в N дней',
    daysBetweenAria: 'Дней между показами',
    daysSuffix: 'дней',
    sectionSchedule: 'Расписание',
    startLabel: 'Начало',
    endLabel: 'Окончание (необязательно)',
    campaignEnabledLabel: 'Кампания включена',
    cancel: 'Отмена',
    save: 'Сохранить',
    create: 'Создать',
    toastSaveError: 'Не удалось сохранить',
    toastUpdated: 'Кампания обновлена',
    toastCreated: 'Кампания создана',
    toastDeleted: 'Кампания удалена',
    toastStatsReset: 'Статистика сброшена',
    deleteTitle: 'Удалить кампанию?',
    deleteDescription: 'Кампания и её статистика будут удалены безвозвратно.',
  },
  productAnalytics: {
    title: 'Аналитика товара',
    period: 'за 30 дней',
    views: 'Просмотры',
    addToCart: 'В корзину',
    unitsSold: 'Продано, шт',
    revenue: 'Выручка',
    cartRate: 'Конверсия в корзину',
    purchaseRate: 'Конверсия в заказ',
  },
  productVariants: {
    axesTitle: 'Оси выбора',
    axesHint:
      'Добавьте оси (например «Размер», или «Цвет» + «Память»). Значения указывайте через запятую. Затем нажмите «Сгенерировать комбинации».',
    typeColor: 'цвет',
    typeText: 'текст',
    removeAxisAria: 'Удалить ось',
    valuesLabel: 'Значения (через запятую)',
    colorPlaceholder: 'Black, Blue, Silver',
    textPlaceholder: '39, 40, 41, 42',
    colorForAria: 'Цвет для',
    newAxisLabel: 'Новая ось',
    newAxisPlaceholder: 'Цвет',
    selectText: 'Текст',
    selectColor: 'Цвет',
    addAxis: 'Добавить ось',
    generateMatrix: 'Сгенерировать комбинации',
    combinationsTitle: 'Комбинации',
    combinationLabel: 'Комбинация',
    priceLabel: 'Цена',
    oldPriceLabel: 'Старая цена',
    quantityLabel: 'Остаток',
    skuLabel: 'SKU',
    variantImageLabel: 'Фото варианта (для выбора цвета)',
  },
  productForm: {
    backToListAria: 'Назад к списку товаров',
    editTitle: 'Редактирование товара',
    createTitle: 'Новый товар',
    idPrefix: 'ID',
    fillInfoHint: 'Заполните информацию о товаре',
    cancel: 'Отмена',
    save: 'Сохранить',
    createProduct: 'Создать товар',
    tabMain: 'Основное',
    tabPrice: 'Цена и остатки',
    tabVariants: 'Варианты',
    tabCategories: 'Категории и группы',
    tabChars: 'Характеристики',
    tabSeo: 'SEO',
    photosTitle: 'Фотографии',
    mainPhotoLabel: 'Главное фото',
    mainPhotoHint: 'Отображается в каталоге и карточке товара.',
    galleryLabel: 'Галерея товара',
    galleryHint: 'Дополнительные фото товара. Можно загрузить несколько сразу.',
    nameSectionTitle: 'Название и описание',
    nameRuLabel: 'Название (RU)',
    nameRuPlaceholder: 'Беспроводные наушники…',
    nameUkLabel: 'Название (UK)',
    nameUkPlaceholder: 'Бездротові навушники…',
    descRuLabel: 'Описание (RU)',
    descUkLabel: 'Описание (UK)',
    notesLabel: 'Приватные заметки (видны только администраторам)',
    identificationTitle: 'Идентификация и статус',
    skuLabel: 'Артикул (SKU)',
    barcodeLabel: 'Штрихкод',
    salesTypeLabel: 'Тип продаж',
    salesTypeRetail: 'Розница',
    salesTypeWholesale: 'Опт',
    salesTypeBoth: 'Розница и опт',
    visibleLabel: 'Показывать на сайте',
    visibleHint: 'Товар виден покупателям',
    popularLabel: 'Популярный товар',
    popularHint: 'Показывается в блоке «Популярные товары»',
    purchaseCounterTitle: 'Счётчик покупок',
    realOrdersLabel: 'Реальные покупки',
    realOrdersHint: 'Считается автоматически по заказам',
    purchasesBoostLabel: 'Накрутка покупок',
    purchasesBoostHint: 'Добавляется к реальному числу покупок',
    shownToBuyersLabel: 'Показывается покупателям',
    shownToBuyersHint: '«Купили N раз» на карточке товара',
    dimensionsTitle: 'Габариты и вес',
    widthLabel: 'Ширина, см',
    heightLabel: 'Высота, см',
    lengthLabel: 'Длина, см',
    weightLabel: 'Вес, кг',
    pricesTitle: 'Цены',
    priceLabel: 'Цена продажи *',
    oldPriceLabel: 'Старая цена (для скидки)',
    costPriceLabel: 'Цена закупки',
    currencyLabel: 'Валюта',
    priceFromLabel: 'Цена «от»',
    priceFromHint: 'Отображать как минимальную цену',
    stockTitle: 'Наличие',
    quantityLabel: 'Количество на складе',
    quantityHint: 'При нуле статус автоматически станет «Нет в наличии»',
    quantityHintVariants: 'Сумма остатков всех комбинаций во вкладке «Варианты»',
    unitLabel: 'Единица измерения',
    variantsActiveNotice:
      'Включены варианты товара — цена и остаток ниже рассчитываются автоматически по вкладке «Варианты» (минимальная цена среди комбинаций, суммарный остаток) и недоступны для ручного редактирования. Чтобы задавать их вручную здесь, выключите варианты на вкладке «Варианты».',
    variantsToggleLabel: 'Включить варианты товара',
    variantsToggleHint:
      'Выбор по цвету, размеру и т.д. Пока выключено — покупатель видит один товар с ценой и остатком с вкладки «Цена и остатки»; ниже настроенные комбинации не применяются (и данные не теряются).',
    variantsOffHint:
      'Включите переключатель выше, чтобы настроить оси выбора (цвет, размер и т.д.) и цену/остаток для каждой комбинации.',
    productCategoriesTitle: 'Категории товара',
    noCategoriesHint: 'Категорий пока нет.',
    createCategoryLink: 'Создать категорию',
    productGroupsTitle: 'Группы товаров',
    noGroupsHint: 'Групп пока нет.',
    createGroupLink: 'Создать группу',
    placementTitle: 'Размещение',
    siteGroupLabel: 'Группа на сайте',
    notSelected: 'Не выбрано',
    marketplaceCategoryLabel: 'Категория маркетплейса',
    charsTitle: 'Характеристики товара',
    charsEmptyHint: 'Характеристики не добавлены. Например: «Цвет — чёрный», «Материал — металл».',
    charNamePlaceholder: 'Название (Цвет)',
    charNameAria: 'Название характеристики',
    charValuePlaceholder: 'Значение (Чёрный)',
    charValueAria: 'Значение характеристики',
    removeCharAria: 'Удалить характеристику',
    addChar: 'Добавить характеристику',
    seoTitle: 'SEO-настройки',
    metaTitleRuLabel: 'Meta Title (RU)',
    metaTitleUkLabel: 'Meta Title (UK)',
    metaDescRuLabel: 'Meta Description (RU)',
    metaDescUkLabel: 'Meta Description (UK)',
    toastNameRequired: 'Укажите название товара хотя бы на одном языке',
    toastPriceInvalid: 'Укажите корректную цену',
    toastUpdated: 'Товар обновлён',
    toastCreated: 'Товар создан',
    toastSaveError: 'Ошибка сохранения',
    saveChanges: 'Сохранить изменения',
  },
  auditLog: {
    cartReminderSent: 'Отправлено напоминание на {{email}}',
    cartsHidden: 'Скрыто корзин: {{count}}',
    logsClearedOld: 'Очистка логов старше {{days}} дн. ({{count}})',
    logsClearedAll: 'Полная очистка логов ({{count}})',
    campaignCreated: 'Создана кампания «{{name}}»',
    campaignUpdated: 'Изменена кампания «{{name}}»',
    campaignEnabled: 'Кампания включена',
    campaignDisabled: 'Кампания выключена',
    campaignDeleted: 'Кампания удалена',
    orderStatusChanged: 'Статус заказа: «{{label}}»',
    orderCreated: 'Заказ создан (№{{number}})',
    paymentStatusChanged: 'Оплата: {{label}}',
    trackingCreated: 'Создана ЭН {{number}}',
    productCreated: 'Создан товар «{{name}}»',
    productUpdated: 'Изменён товар «{{name}}»',
    productsTrashed: 'Товары перемещены в корзину: {{ids}}',
    settingsUpdated: 'Обновлены настройки: {{keys}}',
    settingsUnchanged: 'Настройки сохранены (без изменений)',
    cacheCleared: 'Очищен кеш сайта',
    userCreated: 'Создан пользователь {{email}} (роль: {{role}})',
    userRoleChanged: 'Смена роли пользователя на «{{role}}»',
    userActivated: 'Пользователь активирован',
    userDeactivated: 'Пользователь деактивирован',
    userDeleted: 'Пользователь удалён',
  },
}

const dictionaries: Record<Locale, AdminDictionary> = { uk, ru }

export function getAdminDictionary(locale: Locale): AdminDictionary {
  return dictionaries[locale]
}
