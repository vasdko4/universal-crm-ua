import type { Locale } from './config'

export type Dictionary = {
  common: {
    search: string
    searchPlaceholder: string
    catalog: string
    cart: string
    account: string
    home: string
    all: string
    categories: string
    menu: string
    close: string
    loading: string
    currency: string
    back: string
    apply: string
    reset: string
    yes: string
    no: string
    anonymous: string
  }
  nav: {
    catalog: string
    allProducts: string
    goToCategory: string
    promotions: string
    menu: string
    categories: string
    articles: string
    searchPlaceholder: string
    searchNoResults: string
    searchViewAll: string
    account: string
    cart: string
  }
  articles: {
    title: string
    subtitle: string
    all: string
    readMinutes: string
    empty: string
    backToList: string
    related: string
    notFound: string
    author: string
    categoryNames: Record<string, string>
  }
  header: {
    login: string
    profile: string
    logout: string
    myOrders: string
    chooseLanguage: string
    chooseLanguageDesc: string
  }
  home: {
    popular: string
    newArrivals: string
    allProducts: string
    viewAll: string
    heroTitle: string
    heroSubtitle: string
    shopNow: string
  }
  catalog: {
    title: string
    filters: string
    sort: string
    sortPopular: string
    sortCheap: string
    sortExpensive: string
    sortNew: string
    sortPriceAsc: string
    sortPriceDesc: string
    found: string
    priceFrom: string
    priceTo: string
    inStockOnly: string
    discountOnly: string
    resetFilters: string
    apply: string
    price: string
    nothingFound: string
    nothingFoundDesc: string
    showing: string
    resultsFor: string
  }
  product: {
    addToCart: string
    buyNow: string
    inStock: string
    outOfStock: string
    description: string
    characteristics: string
    reviews: string
    questions: string
    sku: string
    relatedProducts: string
    priceFrom: string
    writeReview: string
    askQuestion: string
    noReviews: string
    addToFavorites: string
    removeFromFavorites: string
    quantity: string
    decrease: string
    increase: string
    inStockCount: string
    unitsShort: string
    selectVariant: string
    notAvailable: string
    addedToCart: string
    addedToCartVariant: string
    deliveryUkraine: string
    officialWarranty: string
    cancel: string
    noDescription: string
    rating: string
    yourName: string
    yourNamePlaceholder: string
    pros: string
    cons: string
    comment: string
    submitReview: string
    submitQuestion: string
    sending: string
    reviewSent: string
    questionSent: string
    questionLabel: string
    noReviewsYet: string
    noQuestionsYet: string
    storeReply: string
    answer: string
    error: string
  }
  favorites: {
    title: string
    empty: string
    emptyDesc: string
    toCatalog: string
    signInHint: string
  }
  cart: {
    title: string
    empty: string
    emptyDesc: string
    continueShopping: string
    total: string
    subtotal: string
    checkout: string
    remove: string
    quantity: string
    goToCatalog: string
  }
  checkout: {
    title: string
    step: string
    contactInfo: string
    firstName: string
    lastName: string
    phone: string
    email: string
    emailOptional: string
    firstNamePlaceholder: string
    lastNamePlaceholder: string
    phonePlaceholder: string
    emailPlaceholder: string
    delivery: string
    npSubtitle: string
    ukrSubtitle: string
    deliveryGeneric: string
    payment: string
    city: string
    cityPlaceholder: string
    branchType: string
    branch: string
    postomat: string
    branchPlaceholder: string
    postomatPlaceholder: string
    ukrCityPlaceholder: string
    ukrIndex: string
    ukrIndexPlaceholder: string
    indexPrefix: string
    address: string
    index: string
    codSubtitle: string
    onlineSubtitle: string
    requisitesSubtitle: string
    comment: string
    commentPlaceholder: string
    placeOrder: string
    submitting: string
    terms: string
    orderSummary: string
    yourOrder: string
    itemsCount: string
    deliveryByCarrier: string
    toPay: string
    minOrderPrefix: string
    minOrderAddMore: string
    promoLabel: string
    promoPlaceholder: string
    promoApply: string
    promoRemove: string
    promoApplied: string
    discount: string
    max: string
    pcs: string
    remove: string
    increase: string
    decrease: string
    quantity: string
    emptyTitle: string
    emptyDesc: string
    toCatalog: string
    success: string
    successTitle: string
    successDesc: string
    orderNumber: string
    orderNumberLabel: string
    successContact: string
    orderComposition: string
    requisitesTitle: string
    goToPayment: string
    myOrders: string
    continueShopping: string
    required: string
    savedAddresses: string
    selectAddress: string
    saveAddress: string
    mNovaPoshta: string
    mUkrposhta: string
    mCod: string
    mOnline: string
    mRequisites: string
    errFirstName: string
    errLastName: string
    errPhone: string
    errDelivery: string
    errCity: string
    errPostomat: string
    errBranch: string
    errUkrCity: string
    errUkrIndex: string
    errPayment: string
    errGeneric: string
    secureCheckout: string
    trustFreeShipping: string
    trustReturn: string
    trustSecurePayment: string
  }
  pay: {
    successTitle: string
    successDesc: string
    myOrders: string
    orderPaymentTitle: string
    payVia: string
    toPay: string
    goToPayment: string
    checkStatus: string
    backToCheckout: string
    gatewayNote: string
    cardPaymentSubtitle: string
    cardNumber: string
    cardExpiry: string
    cardCvv: string
    payButton: string
    processing: string
    demoNote: string
    statusFailed: string
    statusPending: string
    autoChecking: string
    orderDetails: string
  }
  footer: {
    info: string
    catalog: string
    contacts: string
    followUs: string
    rights: string
    terms: string
    privacy: string
    returns: string
    delivery: string
    about: string
    forCustomers: string
    account: string
    myOrders: string
    country: string
    workingHours: string
  }
  account: {
    title: string
    orders: string
    noOrders: string
    orderNumber: string
    status: string
    date: string
    total: string
    navProfile: string
    navOrders: string
    navFavorites: string
    navAddresses: string
    navAdmin: string
    navPromos: string
    promosTitle: string
    promosEmpty: string
    promoCopy: string
    promoCopied: string
    promoUsed: string
    promoMinOrder: string
    promoUntil: string
    promoNoExpiry: string
    promoUsesLeft: string
    logout: string
    addressesTitle: string
    addressesEmpty: string
    addAddress: string
    editAddress: string
    deleteAddress: string
    addressLabel: string
    addressLabelPlaceholder: string
    firstName: string
    lastName: string
    phone: string
    deliveryMethod: string
    novaPoshta: string
    ukrposhta: string
    city: string
    branch: string
    branchType: string
    branchOption: string
    postomatOption: string
    postIndex: string
    setDefault: string
    defaultBadge: string
    save: string
    cancel: string
    saving: string
    deleteConfirm: string
    addressSaved: string
    addressDeleted: string
    genericError: string
  }
  cookieConsent: {
    message: string
    accept: string
    decline: string
  }
  // Error strings generated in server actions (app/actions/shop.ts,
  // app/actions/promotions.ts) and shown to the shopper as-is — these must be
  // resolved via getLocale() server-side since, unlike static page text, they
  // are only ever built once, at the moment of the error, not re-rendered
  // per-locale by the page.
  serverErrors: {
    rateLimitOrders: string
    rateLimitGeneric: string
    someItemsUnavailable: string
    variantUnavailable: string
    variantOutOfStock: string
    productOutOfStock: string
    orderNotFound: string
    orderPaidViaGateway: string
    paymentInvoiceFailed: string
    reviewTextRequired: string
    questionRequired: string
    promoCodeRequired: string
    cartEmpty: string
    promoNotFound: string
    promoInactive: string
    promoNotYetActive: string
    promoExpired: string
    promoUsageLimitReached: string
    promoMinOrder: string
    promoNotApplicable: string
    promoNoDiscount: string
    tooManyItems: string
    invalidCartItem: string
    invalidQuantity: string
    invalidVariant: string
    nameAndPhoneRequired: string
    invalidPhone: string
    invalidEmail: string
    deliveryMethodRequired: string
    paymentMethodRequired: string
  }
}

const uk: Dictionary = {
  common: {
    search: 'Пошук',
    searchPlaceholder: 'Пошук товарів...',
    catalog: 'Каталог',
    cart: 'Кошик',
    account: 'Кабінет',
    home: 'Головна',
    all: 'Усі',
    categories: 'Категорії',
    menu: 'Меню',
    close: 'Закрити',
    loading: 'Завантаження...',
    currency: '₴',
    back: 'Назад',
    apply: 'Застосувати',
    reset: 'Скинути',
    yes: 'Так',
    no: 'Ні',
    anonymous: 'Анонім',
  },
  nav: {
    catalog: 'Каталог',
    allProducts: 'Усі товари',
    promotions: 'Акції',
    goToCategory: 'Перейти до категорії',
    menu: 'Меню',
    categories: 'Категорії',
    articles: 'Статті',
    searchPlaceholder: 'Пошук товарів...',
    searchNoResults: 'Нічого не знайдено',
    searchViewAll: 'Показати всі результати',
    account: 'Кабінет',
    cart: 'Кошик',
  },
  articles: {
    title: 'Статті та новини',
    subtitle: 'Корисні матеріали, огляди та поради від нашої команди',
    all: 'Усі статті',
    readMinutes: 'хв читання',
    empty: 'Поки що немає опублікованих статей',
    backToList: 'Усі статті',
    related: 'Схожі статті',
    notFound: 'Статтю не знайдено',
    author: 'Автор',
    categoryNames: { news: 'Новини', reviews: 'Огляди', guides: 'Гайди' },
  },
  header: {
    login: 'Увійти',
    profile: 'Профіль',
    logout: 'Вийти',
    myOrders: 'Мої замовлення',
    chooseLanguage: 'Оберіть мову',
    chooseLanguageDesc: 'Виберіть мову, якою зручніше користуватися магазином',
  },
  home: {
    popular: 'Популярні товари',
    newArrivals: 'Новинки',
    allProducts: 'Усі товари',
    viewAll: 'Дивитися всі',
    heroTitle: 'Техніка для вашого дому',
    heroSubtitle: 'Найкращі товари за найкращими цінами',
    shopNow: 'До покупок',
  },
  catalog: {
    title: 'Каталог товарів',
    filters: 'Фільтри',
    sort: 'Сортування',
    sortPopular: 'Популярні',
    sortCheap: 'Спочатку дешевші',
    sortExpensive: 'Спочатку дорожчі',
    sortNew: 'Новинки',
    sortPriceAsc: 'Спочатку дешевші',
    sortPriceDesc: 'Спочатку дорожчі',
    found: 'Знайдено товарів',
    priceFrom: 'Ціна від',
    priceTo: 'Ціна до',
    inStockOnly: 'Тільки в наявності',
    discountOnly: 'Зі знижкою',
    resetFilters: 'Скинути',
    apply: 'Застосувати',
    price: 'Ціна',
    nothingFound: 'Нічого не знайдено',
    nothingFoundDesc: 'Спробуйте змінити параметри пошуку або фільтри',
    showing: 'Показано',
    resultsFor: 'Результати за запитом',
  },
  product: {
    addToCart: 'До кошика',
    buyNow: 'Купити зараз',
    inStock: 'В наявності',
    outOfStock: 'Немає в наявності',
    description: 'Опис',
    characteristics: 'Характеристики',
    reviews: 'Відгуки',
    questions: 'Питання',
    sku: 'Артикул',
    relatedProducts: 'Схожі товари',
    priceFrom: 'від',
    writeReview: 'Написати відгук',
    askQuestion: 'Поставити питання',
    noReviews: 'Відгуків ще немає',
    addToFavorites: 'Додати в обране',
    removeFromFavorites: 'Прибрати з обраного',
    quantity: 'Кількість:',
    decrease: 'Менше',
    increase: 'Більше',
    inStockCount: 'В наявності:',
    unitsShort: 'шт.',
    selectVariant: 'Оберіть варіант товару',
    notAvailable: 'Товару немає в наявності',
    addedToCart: 'Товар додано в кошик',
    addedToCartVariant: 'Додано в кошик',
    deliveryUkraine: 'Доставка по всій Україні',
    officialWarranty: 'Офіційна гарантія',
    cancel: 'Скасувати',
    noDescription: 'Опис відсутній.',
    rating: 'Оцінка',
    yourName: "Ім'я",
    yourNamePlaceholder: "Ваше ім'я",
    pros: 'Переваги',
    cons: 'Недоліки',
    comment: 'Коментар',
    submitReview: 'Надіслати відгук',
    submitQuestion: 'Надіслати питання',
    sending: 'Надсилання...',
    reviewSent: 'Дякуємо! Відгук надіслано на модерацію',
    questionSent: 'Питання надіслано! Ми відповімо після перевірки',
    questionLabel: 'Питання',
    noReviewsYet: 'Відгуків поки немає. Будьте першим!',
    noQuestionsYet: 'Питань поки немає. Поставте першим!',
    storeReply: 'Відповідь магазину:',
    answer: 'Відповідь:',
    error: 'Помилка',
  },
  favorites: {
    title: 'Обране',
    empty: 'У вас немає обраних товарів',
    emptyDesc: 'Натискайте на сердечко на товарах, щоб зберегти їх тут.',
    toCatalog: 'До каталогу',
    signInHint: 'Увійдіть, щоб обране зберігалося у вашому акаунті.',
  },
  cart: {
    title: 'Кошик',
    empty: 'Ваш кошик порожній',
    emptyDesc: 'Додайте товари, щоб оформити замовлення',
    continueShopping: 'Продовжити покупки',
    total: 'Разом',
    subtotal: 'Сума',
    checkout: 'Оформити замовлення',
    remove: 'Видалити',
    quantity: 'Кількість',
    goToCatalog: 'До каталогу',
  },
  checkout: {
    title: 'Оформлення замовлення',
    step: 'Крок',
    contactInfo: 'Контактні дані',
    firstName: "Ім'я",
    lastName: 'Прізвище',
    phone: 'Телефон',
    email: 'Ел. пошта',
    emailOptional: 'Email (необов’язково)',
    firstNamePlaceholder: 'Іван',
    lastNamePlaceholder: 'Петренко',
    phonePlaceholder: '+380 XX XXX XX XX',
    emailPlaceholder: 'you@example.com',
    delivery: 'Доставка',
    npSubtitle: 'Доставка у відділення по всій Україні',
    ukrSubtitle: 'Доставка у відділення Укрпошти',
    deliveryGeneric: 'Доставка',
    payment: 'Оплата',
    city: 'Місто',
    cityPlaceholder: 'Почніть вводити місто',
    branchType: 'Тип отримання',
    branch: 'Відділення',
    postomat: 'Поштомат',
    branchPlaceholder: 'Наприклад: Відділення №5 або вулиця, будинок',
    postomatPlaceholder: 'Наприклад: Поштомат №1234',
    ukrCityPlaceholder: 'Київ',
    ukrIndex: 'Поштовий індекс відділення',
    ukrIndexPlaceholder: '01001',
    indexPrefix: 'Індекс',
    address: 'Адреса',
    index: 'Індекс',
    codSubtitle: 'Оплата при отриманні у відділенні',
    onlineSubtitle: 'Оплата карткою онлайн',
    requisitesSubtitle: 'Оплата за банківськими реквізитами',
    comment: 'Коментар до замовлення',
    commentPlaceholder: 'Додаткова інформація для менеджера',
    placeOrder: 'Підтвердити замовлення',
    submitting: 'Оформлюємо…',
    terms: 'Натискаючи кнопку, ви погоджуєтесь з умовами обробки замовлення',
    orderSummary: 'Разом до сплати',
    yourOrder: 'Ваше замовлення',
    itemsCount: 'Товари',
    deliveryByCarrier: 'за тарифами перевізника',
    toPay: 'До сплати',
    minOrderPrefix: 'Мінімальна сума замовлення —',
    minOrderAddMore: 'Додайте товарів ще на',
    promoLabel: 'Промокод',
    promoPlaceholder: 'Введіть промокод',
    promoApply: 'Застосувати',
    promoRemove: 'Прибрати',
    promoApplied: 'Промокод застосовано',
    discount: 'Знижка',
    max: 'Максимум',
    pcs: 'шт.',
    remove: 'Видалити',
    increase: 'Збільшити кількість',
    decrease: 'Зменшити кількість',
    quantity: 'Кількість',
    emptyTitle: 'Кошик порожній',
    emptyDesc: 'Додайте товари, щоб оформити замовлення.',
    toCatalog: 'До каталогу',
    success: 'Замовлення оформлено!',
    successTitle: 'Замовлення оформлено!',
    successDesc: "Ми зв'яжемося з вами для підтвердження",
    orderNumber: 'Номер замовлення',
    orderNumberLabel: 'Номер вашого замовлення:',
    successContact: "Ми зв'яжемося з вами для підтвердження. Сума до сплати:",
    orderComposition: 'Склад замовлення',
    requisitesTitle: 'Реквізити для оплати',
    goToPayment: 'Перейти до оплати',
    myOrders: 'Мої замовлення',
    continueShopping: 'Продовжити покупки',
    required: "обов'язкове поле",
    savedAddresses: 'Збережені адреси',
    selectAddress: 'Обрати збережену адресу',
    saveAddress: 'Зберегти цю адресу в кабінеті',
    errFirstName: "Введіть ім'я",
    errLastName: 'Введіть прізвище',
    errPhone: 'Введіть коректний номер телефону',
    errDelivery: 'Оберіть спосіб доставки',
    errCity: 'Оберіть місто',
    errPostomat: 'Вкажіть поштомат',
    errBranch: 'Вкажіть відділення',
    errUkrCity: 'Введіть місто',
    errUkrIndex: 'Введіть поштовий індекс відділення',
    errPayment: 'Оберіть спосіб оплати',
    errGeneric: 'Не вдалося оформити замовлення',
    secureCheckout: 'Безпечне оформлення',
    trustFreeShipping: 'Безкоштовна доставка від 2000 ₴',
    trustReturn: 'Повернення протягом 14 днів',
    trustSecurePayment: 'Безпечна оплата',
    mNovaPoshta: 'Нова Пошта',
    mUkrposhta: 'Укрпошта',
    mCod: 'Накладений платіж',
    mOnline: 'Оплата карткою онлайн',
    mRequisites: 'Оплата за реквізитами',
  },
  pay: {
    successTitle: 'Оплата пройшла успішно',
    successDesc: 'Замовлення №{orderNumber} оплачено. Дякуємо за покупку!',
    myOrders: 'Мої замовлення',
    orderPaymentTitle: 'Оплата замовлення №{orderNumber}',
    payVia: 'Оплата через {gateway}',
    toPay: 'До сплати',
    goToPayment: 'Перейти до оплати',
    checkStatus: 'Я оплатив — перевірити статус',
    backToCheckout: 'Повернутися до оформлення замовлення',
    gatewayNote:
      'Після оплати статус замовлення оновиться автоматично. Замовлення буде оформлено лише після успішної оплати.',
    cardPaymentSubtitle: 'Безпечна оплата карткою',
    cardNumber: 'Номер картки',
    cardExpiry: 'Термін',
    cardCvv: 'CVV',
    payButton: 'Сплатити',
    processing: 'Обробка…',
    demoNote: 'Демо-режим платіжного шлюзу. Замовлення оформиться після оплати.',
    statusFailed: 'Оплата не пройшла. Спробуйте сплатити ще раз.',
    statusPending: 'Оплата ще не надійшла. Якщо ви вже сплатили — зачекайте хвилину та перевірте знову.',
    autoChecking: 'Перевіряємо статус оплати…',
    orderDetails: 'Деталі замовлення',
  },
  footer: {
    info: 'Інформація',
    catalog: 'Каталог',
    contacts: 'Контакти',
    followUs: 'Ми в соцмережах',
    rights: 'Усі права захищено.',
    terms: 'Угода користувача',
    privacy: 'Політика конфіденційності',
    returns: 'Політика повернень',
    delivery: 'Про доставку',
    about: 'Магазин електроніки та аксесуарів. Доставка по всій Україні, гарантія на всі товари.',
    forCustomers: 'Покупцю',
    account: 'Особистий кабінет',
    myOrders: 'Мої замовлення',
    country: 'Україна',
    workingHours: 'Графік роботи',
  },
  account: {
    title: 'Особистий кабінет',
    orders: 'Замовлення',
    noOrders: 'У вас ще немає замовлень',
    orderNumber: 'Номер',
    status: 'Статус',
    date: 'Дата',
    total: 'Сума',
    navProfile: 'Профіль',
    navOrders: 'Мої замовлення',
    navFavorites: 'Обране',
    navAddresses: 'Мої адреси',
    navAdmin: 'Адмін-центр',
    navPromos: 'Промокоди',
    promosTitle: 'Мої промокоди',
    promosEmpty: 'Наразі доступних промокодів немає. Слідкуйте за акціями!',
    promoCopy: 'Копіювати',
    promoCopied: 'Скопійовано',
    promoUsed: 'Використано',
    promoMinOrder: 'Мін. замовлення',
    promoUntil: 'Діє до',
    promoNoExpiry: 'Без обмеження терміну',
    promoUsesLeft: 'Залишилось використань',
    logout: 'Вийти',
    addressesTitle: 'Мої адреси',
    addressesEmpty: 'У вас ще немає збережених адрес',
    addAddress: 'Додати адресу',
    editAddress: 'Редагувати адресу',
    deleteAddress: 'Видалити',
    addressLabel: 'Назва адреси',
    addressLabelPlaceholder: 'Напр.: Дім, Робота',
    firstName: "Ім'я",
    lastName: 'Прізвище',
    phone: 'Телефон',
    deliveryMethod: 'Спосіб доставки',
    novaPoshta: 'Нова Пошта',
    ukrposhta: 'Укрпошта',
    city: 'Місто',
    branch: 'Відділення',
    branchType: 'Тип отримання',
    branchOption: 'Відділення',
    postomatOption: 'Поштомат',
    postIndex: 'Поштовий індекс',
    setDefault: 'Зробити основною',
    defaultBadge: 'Основна',
    save: 'Зберегти',
    cancel: 'Скасувати',
    saving: 'Збереження…',
    deleteConfirm: 'Видалити цю адресу?',
    addressSaved: 'Адресу збережено',
    addressDeleted: 'Адресу видалено',
    genericError: 'Сталася помилка. Спробуйте ще раз.',
  },
  cookieConsent: {
    message:
      'Ми використовуємо файли cookie для аналітики та персоналізованої реклами, щоб покращувати сайт і пропозиції.',
    accept: 'Прийняти',
    decline: 'Відхилити',
  },
  serverErrors: {
    rateLimitOrders: 'Забагато замовлень поспіль. Спробуйте пізніше.',
    rateLimitGeneric: 'Забагато запитів, спробуйте пізніше',
    someItemsUnavailable: 'Деякі товари недоступні',
    variantUnavailable: 'Варіант товару «{{name}}» недоступний',
    variantOutOfStock: 'Недостатньо товару «{{name}}» ({{label}}) на складі',
    productOutOfStock: 'Недостатньо товару «{{name}}» на складі',
    orderNotFound: 'Замовлення не знайдено',
    orderPaidViaGateway: 'Замовлення оплачується через платіжний шлюз — скористайтесь перевіркою статусу',
    paymentInvoiceFailed: 'Не вдалося створити рахунок на оплату. Спробуйте ще раз або оберіть інший спосіб оплати.',
    reviewTextRequired: 'Введіть текст відгуку',
    questionRequired: 'Введіть запитання',
    promoCodeRequired: 'Введіть промокод',
    cartEmpty: 'Кошик порожній',
    promoNotFound: 'Промокод не знайдено',
    promoInactive: 'Промокод неактивний',
    promoNotYetActive: 'Промокод ще не діє',
    promoExpired: 'Термін дії промокоду закінчився',
    promoUsageLimitReached: 'Ліміт використання промокоду вичерпано',
    promoMinOrder: 'Мінімальна сума замовлення для промокоду — {{amount}} грн',
    promoNotApplicable: 'Промокод не застосовується до товарів у кошику',
    promoNoDiscount: 'Промокод не дає знижки на це замовлення',
    tooManyItems: 'Забагато позицій у замовленні (максимум {{max}})',
    invalidCartItem: 'Некоректний товар у кошику',
    invalidQuantity: 'Некоректна кількість товару',
    invalidVariant: 'Некоректний варіант товару',
    nameAndPhoneRequired: 'Вкажіть ім\u2019я та телефон',
    invalidPhone: 'Вкажіть коректний номер телефону',
    invalidEmail: 'Вкажіть коректний email',
    deliveryMethodRequired: 'Оберіть спосіб доставки',
    paymentMethodRequired: 'Оберіть спосіб оплати',
  },
}

const ru: Dictionary = {
  common: {
    search: 'Поиск',
    searchPlaceholder: 'Поиск товаров...',
    catalog: 'Каталог',
    cart: 'Корзина',
    account: 'Кабинет',
    home: 'Главная',
    all: 'Все',
    categories: 'Категории',
    menu: 'Меню',
    close: 'Закрыть',
    loading: 'Загрузка...',
    currency: '₴',
    back: 'Назад',
    apply: 'Применить',
    reset: 'Сбросить',
    yes: 'Да',
    no: 'Нет',
    anonymous: 'Аноним',
  },
  nav: {
    catalog: 'Каталог',
    allProducts: 'Все товары',
    goToCategory: 'Перейти в категорию',
    promotions: 'Акции',
    menu: 'Меню',
    categories: 'Категории',
    articles: 'Статьи',
    searchPlaceholder: 'Поиск товаров...',
    searchNoResults: 'Ничего не найдено',
    searchViewAll: 'Показать все результаты',
    account: 'Кабинет',
    cart: 'Корзина',
  },
  articles: {
    title: 'Статьи и новости',
    subtitle: 'Полезные материалы, обзоры и советы от нашей команды',
    all: 'Все статьи',
    readMinutes: 'мин чтения',
    empty: 'Пока нет опубликованных статей',
    backToList: 'Все статьи',
    related: 'Похожие статьи',
    notFound: 'Статья не найдена',
    author: 'Автор',
    categoryNames: { news: 'Новости', reviews: 'Обзоры', guides: 'Гайды' },
  },
  header: {
    login: 'Войти',
    profile: 'Профиль',
    logout: 'Выйти',
    myOrders: 'Мои заказы',
    chooseLanguage: 'Выберите язык',
    chooseLanguageDesc: 'Выберите язык, на котором удобнее пользоваться магазином',
  },
  home: {
    popular: 'Популярные товары',
    newArrivals: 'Новинки',
    allProducts: 'Все товары',
    viewAll: 'Смотреть все',
    heroTitle: 'Техника для вашего дома',
    heroSubtitle: 'Лучшие товары по лучшим ценам',
    shopNow: 'За покупками',
  },
  catalog: {
    title: 'Каталог товаров',
    filters: 'Фильтры',
    sort: 'Сортировка',
    sortPopular: 'Популярные',
    sortCheap: 'Сначала дешевле',
    sortExpensive: 'Сначала дороже',
    sortNew: 'Новинки',
    sortPriceAsc: 'Сначала дешёвые',
    sortPriceDesc: 'Сначала дорогие',
    found: 'Найдено товаров',
    priceFrom: 'Цена от',
    priceTo: 'Цена до',
    inStockOnly: 'Только в наличии',
    discountOnly: 'Со скидкой',
    resetFilters: 'Сбросить',
    apply: 'Применить',
    price: 'Цена',
    nothingFound: 'Ничего не найдено',
    nothingFoundDesc: 'Попробуйте изменить параметры поиска или фильтры',
    showing: 'Показано',
    resultsFor: 'Результаты по запросу',
  },
  product: {
    addToCart: 'В корзину',
    buyNow: 'Купить сейчас',
    inStock: 'В наличии',
    outOfStock: 'Нет в наличии',
    description: 'Описание',
    characteristics: 'Характеристики',
    reviews: 'Отзывы',
    questions: 'Вопросы',
    sku: 'Артикул',
    relatedProducts: 'Похожие товары',
    priceFrom: 'от',
    writeReview: 'Написать отзыв',
    askQuestion: 'Задать вопрос',
    noReviews: 'Отзывов пока нет',
    addToFavorites: 'Добавить в избранное',
    removeFromFavorites: 'Убрать из избранного',
    quantity: 'Количество:',
    decrease: 'Меньше',
    increase: 'Больше',
    inStockCount: 'В наличии:',
    unitsShort: 'шт.',
    selectVariant: 'Выберите вариант товара',
    notAvailable: 'Товара нет в наличии',
    addedToCart: 'Товар добавлен в корзину',
    addedToCartVariant: 'Добавлено в корзину',
    deliveryUkraine: 'Доставка по всей Украине',
    officialWarranty: 'Официальная гарантия',
    cancel: 'Отмена',
    noDescription: 'Описание отсутствует.',
    rating: 'Оценка',
    yourName: 'Имя',
    yourNamePlaceholder: 'Ваше имя',
    pros: 'Достоинства',
    cons: 'Недостатки',
    comment: 'Комментарий',
    submitReview: 'Отправить отзыв',
    submitQuestion: 'Отправить вопрос',
    sending: 'Отправка...',
    reviewSent: 'Спасибо! Отзыв отправлен на модерацию',
    questionSent: 'Вопрос отправлен! Мы ответим после проверки',
    questionLabel: 'Вопрос',
    noReviewsYet: 'Отзывов пока нет. Будьте первым!',
    noQuestionsYet: 'Вопросов пока нет. Задайте первым!',
    storeReply: 'Ответ магазина:',
    answer: 'Ответ:',
    error: 'Ошибка',
  },
  favorites: {
    title: 'Избранное',
    empty: 'У вас нет избранных товаров',
    emptyDesc: 'Нажимайте на сердечко на товарах, чтобы сохранить их здесь.',
    toCatalog: 'В каталог',
    signInHint: 'Войдите, чтобы избранное сохранялось в вашем аккаунте.',
  },
  cart: {
    title: 'Корзина',
    empty: 'Ваша корзина пуста',
    emptyDesc: 'Добавьте товары, чтобы оформить заказ',
    continueShopping: 'Продолжить покупки',
    total: 'Итого',
    subtotal: 'Сумма',
    checkout: 'Оформить заказ',
    remove: 'Удалить',
    quantity: 'Количество',
    goToCatalog: 'В каталог',
  },
  checkout: {
    title: 'Оформление заказа',
    step: 'Шаг',
    contactInfo: 'Контактные данные',
    firstName: 'Имя',
    lastName: 'Фамилия',
    phone: 'Телефон',
    email: 'Эл. почта',
    emailOptional: 'Email (необязательно)',
    firstNamePlaceholder: 'Иван',
    lastNamePlaceholder: 'Петренко',
    phonePlaceholder: '+380 XX XXX XX XX',
    emailPlaceholder: 'you@example.com',
    delivery: 'Доставка',
    npSubtitle: 'Доставка в отделение по всей Украине',
    ukrSubtitle: 'Доставка в отделение Укрпочты',
    deliveryGeneric: 'Доставка',
    payment: 'Оплата',
    city: 'Город',
    cityPlaceholder: 'Начните вводить город',
    branchType: 'Тип получения',
    branch: 'Отделение',
    postomat: 'Почтомат',
    branchPlaceholder: 'Например: Отделение №5 или улица, дом',
    postomatPlaceholder: 'Например: Почтомат №1234',
    ukrCityPlaceholder: 'Киев',
    ukrIndex: 'Почтовый индекс отделения',
    ukrIndexPlaceholder: '01001',
    indexPrefix: 'Индекс',
    address: 'Адрес',
    index: 'Индекс',
    codSubtitle: 'Оплата при получении в отделении',
    onlineSubtitle: 'Оплата картой онлайн',
    requisitesSubtitle: 'Оплата по банковским реквизитам',
    comment: 'Комментарий к заказу',
    commentPlaceholder: 'Дополнительная информация для менеджера',
    placeOrder: 'Подтвердить заказ',
    submitting: 'Оформляем…',
    terms: 'Нажимая кнопку, вы соглашаетесь с условиями обработки заказа',
    orderSummary: 'Итого к оплате',
    yourOrder: 'Ваш заказ',
    itemsCount: 'Товары',
    deliveryByCarrier: 'по тарифам перевозчика',
    toPay: 'К оплате',
    minOrderPrefix: 'Минимальная сумма заказа —',
    minOrderAddMore: 'Добавьте товаров ещё на',
    promoLabel: 'Промокод',
    promoPlaceholder: 'Введите промокод',
    promoApply: 'Применить',
    promoRemove: 'Убрать',
    promoApplied: 'Промокод применён',
    discount: 'Скидка',
    max: 'Максимум',
    pcs: 'шт.',
    remove: 'Удалить',
    increase: 'Увеличить количество',
    decrease: 'Уменьшить количество',
    quantity: 'Количество',
    emptyTitle: 'Корзина пуста',
    emptyDesc: 'Добавьте товары, чтобы оформить заказ.',
    toCatalog: 'В каталог',
    success: 'Заказ оформлен!',
    successTitle: 'Заказ оформлен!',
    successDesc: 'Мы свяжемся с вами для подтверждения',
    orderNumber: 'Номер заказа',
    orderNumberLabel: 'Номер вашего заказа:',
    successContact: 'Мы свяжемся с вами для подтверждения. Сумма к оплате:',
    orderComposition: 'Состав заказа',
    requisitesTitle: 'Реквизиты для оплаты',
    goToPayment: 'Перейти к оплате',
    myOrders: 'Мои заказы',
    continueShopping: 'Продолжить покупки',
    required: 'обязательное поле',
    savedAddresses: 'Сохранённые адреса',
    selectAddress: 'Выбрать сохранённый адрес',
    saveAddress: 'Сохранить этот адрес в кабинете',
    errFirstName: 'Введите имя',
    errLastName: 'Введите фамилию',
    errPhone: 'Введите корректный номер телефона',
    errDelivery: 'Выберите способ доставки',
    errCity: 'Выберите город',
    errPostomat: 'Укажите почтомат',
    errBranch: 'Укажите отделение',
    errUkrCity: 'Введите город',
    errUkrIndex: 'Введите почтовый индекс отделения',
    errPayment: 'Выберите способ оплаты',
    errGeneric: 'Не удалось оформить заказ',
    secureCheckout: 'Безопасное оформление',
    trustFreeShipping: 'Бесплатная доставка от 2000 ₴',
    trustReturn: 'Возврат в течение 14 дней',
    trustSecurePayment: 'Безопасная оплата',
    mNovaPoshta: 'Новая Почта',
    mUkrposhta: 'Укрпочта',
    mCod: 'Наложенный платёж',
    mOnline: 'Оплата картой онлайн',
    mRequisites: 'Оплата по реквизитам',
  },
  pay: {
    successTitle: 'Оплата прошла успешно',
    successDesc: 'Заказ №{orderNumber} оплачен. Спасибо за покупку!',
    myOrders: 'Мои заказы',
    orderPaymentTitle: 'Оплата заказа №{orderNumber}',
    payVia: 'Оплата через {gateway}',
    toPay: 'К оплате',
    goToPayment: 'Перейти к оплате',
    checkStatus: 'Я оплатил — проверить статус',
    backToCheckout: 'Вернуться к оформлению заказа',
    gatewayNote:
      'После оплаты статус заказа обновится автоматически. Заказ будет оформлен только после успешной оплаты.',
    cardPaymentSubtitle: 'Безопасная оплата картой',
    cardNumber: 'Номер карты',
    cardExpiry: 'Срок',
    cardCvv: 'CVV',
    payButton: 'Оплатить',
    processing: 'Обработка…',
    demoNote: 'Демо-режим платёжного шлюза. Заказ оформится после оплаты.',
    statusFailed: 'Оплата не прошла. Попробуйте оплатить ещё раз.',
    statusPending: 'Оплата ещё не поступила. Если вы уже оплатили — подождите минуту и проверьте снова.',
    autoChecking: 'Проверяем статус оплаты…',
    orderDetails: 'Детали заказа',
  },
  footer: {
    info: 'Информация',
    catalog: 'Каталог',
    contacts: 'Контакты',
    followUs: 'Мы в соцсетях',
    rights: 'Все права защищены.',
    terms: 'Пользовательское соглашение',
    privacy: 'Политика конфиденциальности',
    returns: 'Политика возвратов',
    delivery: 'О доставке',
    about: 'Магазин электроники и аксессуаров. Доставка по всей Украине, гарантия на все товары.',
    forCustomers: 'Покупателю',
    account: 'Личный кабинет',
    myOrders: 'Мои заказы',
    country: 'Украина',
    workingHours: 'График работы',
  },
  account: {
    title: 'Личный кабинет',
    orders: 'Заказы',
    noOrders: 'У вас ещё нет заказов',
    orderNumber: 'Номер',
    status: 'Статус',
    date: 'Дата',
    total: 'Сумма',
    navProfile: 'Профиль',
    navOrders: 'Мои заказы',
    navFavorites: 'Избранное',
    navAddresses: 'Мои адреса',
    navAdmin: 'Админ-центр',
    navPromos: 'Промокоды',
    promosTitle: 'Мои промокоды',
    promosEmpty: 'Сейчас доступных промокодов нет. Следите за акциями!',
    promoCopy: 'Копировать',
    promoCopied: 'Скопировано',
    promoUsed: 'Использован',
    promoMinOrder: 'Мин. заказ',
    promoUntil: 'Действует до',
    promoNoExpiry: 'Без ограничения срока',
    promoUsesLeft: 'Осталось использований',
    logout: 'Выйти',
    addressesTitle: 'Мои адреса',
    addressesEmpty: 'У вас ещё нет сохранённых адресов',
    addAddress: 'Добавить адрес',
    editAddress: 'Редактировать адрес',
    deleteAddress: 'Удалить',
    addressLabel: 'Название адреса',
    addressLabelPlaceholder: 'Напр.: Дом, Работа',
    firstName: 'Имя',
    lastName: 'Фамилия',
    phone: 'Телефон',
    deliveryMethod: 'Способ доставки',
    novaPoshta: 'Новая Почта',
    ukrposhta: 'Укрпочта',
    city: 'Город',
    branch: 'Отделение',
    branchType: 'Тип получения',
    branchOption: 'Отделение',
    postomatOption: 'Почтомат',
    postIndex: 'Почтовый индекс',
    setDefault: 'Сделать основным',
    defaultBadge: 'Основной',
    save: 'Сохранить',
    cancel: 'Отмена',
    saving: 'Сохранение…',
    deleteConfirm: 'Удалить этот адрес?',
    addressSaved: 'Адрес сохранён',
    addressDeleted: 'Адрес удалён',
    genericError: 'Произошла ошибка. Попробуйте ещё раз.',
  },
  cookieConsent: {
    message:
      'Мы используем файлы cookie для аналитики и персонализированной рекламы, чтобы улучшать сайт и предложения.',
    accept: 'Принять',
    decline: 'Отклонить',
  },
  serverErrors: {
    rateLimitOrders: 'Слишком много заказов подряд. Попробуйте позже.',
    rateLimitGeneric: 'Слишком много запросов, попробуйте позже',
    someItemsUnavailable: 'Некоторые товары недоступны',
    variantUnavailable: 'Вариант товара «{{name}}» недоступен',
    variantOutOfStock: 'Недостаточно товара «{{name}}» ({{label}}) на складе',
    productOutOfStock: 'Недостаточно товара «{{name}}» на складе',
    orderNotFound: 'Заказ не найден',
    orderPaidViaGateway: 'Заказ оплачивается через платёжный шлюз — используйте проверку статуса',
    paymentInvoiceFailed: 'Не удалось создать счёт на оплату. Попробуйте ещё раз или выберите другой способ оплаты.',
    reviewTextRequired: 'Введите текст отзыва',
    questionRequired: 'Введите вопрос',
    promoCodeRequired: 'Введите промокод',
    cartEmpty: 'Корзина пуста',
    promoNotFound: 'Промокод не найден',
    promoInactive: 'Промокод неактивен',
    promoNotYetActive: 'Промокод ещё не действует',
    promoExpired: 'Срок действия промокода истёк',
    promoUsageLimitReached: 'Лимит использования промокода исчерпан',
    promoMinOrder: 'Минимальная сумма заказа для промокода — {{amount}} грн',
    promoNotApplicable: 'Промокод не применяется к товарам в корзине',
    promoNoDiscount: 'Промокод не даёт скидки на этот заказ',
    tooManyItems: 'Слишком много позиций в заказе (максимум {{max}})',
    invalidCartItem: 'Некорректный товар в корзине',
    invalidQuantity: 'Некорректное количество товара',
    invalidVariant: 'Некорректный вариант товара',
    nameAndPhoneRequired: 'Укажите имя и телефон',
    invalidPhone: 'Укажите корректный номер телефона',
    invalidEmail: 'Укажите корректный email',
    deliveryMethodRequired: 'Выберите способ доставки',
    paymentMethodRequired: 'Выберите способ оплаты',
  },
}

export const dictionaries: Record<Locale, Dictionary> = { uk, ru }

export function getDictionary(locale: Locale): Dictionary {
  return dictionaries[locale] ?? uk
}

/**
 * Fills `{{name}}`-style placeholders in a dictionary string, e.g.
 * `fillTemplate(t.serverErrors.productOutOfStock, { name: p.name })`. Used by
 * server actions that build a dynamic, locale-dependent error message instead
 * of returning a static dictionary string as-is.
 */
export function fillTemplate(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => String(values[key] ?? ''))
}
