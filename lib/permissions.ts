import {
  LayoutDashboard,
  BookOpen,
  Package,
  FolderTree,
  Layers,
  Users,
  ShoppingCart,
  ShoppingBasket,
  Percent,
  Megaphone,
  TrendingUp,
  FileText,
  Newspaper,
  MessageSquare,
  Truck,
  CreditCard,
  BarChart3,
  Settings,
  Shield,
  FileUp,
  Trash2,
  ScrollText,
  type LucideIcon,
} from 'lucide-react'

// Every protectable area of the admin center. 'admin' implicitly has '*'.
export type PermissionKey =
  | 'dashboard'
  | 'orders'
  | 'products'
  | 'categories'
  | 'groups'
  | 'promotions'
  | 'modal_ads'
  | 'abandoned_carts'
  | 'bestsellers'
  | 'customers'
  | 'pages'
  | 'articles'
  | 'reviews'
  | 'delivery'
  | 'payments'
  | 'statistics'
  | 'settings'
  | 'users'
  | 'import'
  | 'trash'
  | 'logs'

export type NavItem = {
  href: string
  label: string
  icon: LucideIcon
  permission: PermissionKey
}

export type NavSection = {
  label: string
  items: NavItem[]
}

export const NAV_SECTIONS: NavSection[] = [
  {
    label: 'Обзор',
    items: [
      { href: '/admin', label: 'Дашборд', icon: LayoutDashboard, permission: 'dashboard' },
      { href: '/admin/statistics', label: 'Статистика', icon: BarChart3, permission: 'statistics' },
      { href: '/admin/guides', label: 'Инструкции', icon: BookOpen, permission: 'dashboard' },
    ],
  },
  {
    label: 'Продажи',
    items: [
      { href: '/admin/orders', label: 'Заказы', icon: ShoppingCart, permission: 'orders' },
      { href: '/admin/abandoned-carts', label: 'Брошенные корзины', icon: ShoppingBasket, permission: 'abandoned_carts' },
      { href: '/admin/customers', label: 'Клиенты', icon: Users, permission: 'customers' },
    ],
  },
  {
    label: 'Каталог',
    items: [
      { href: '/admin/products', label: 'Товары', icon: Package, permission: 'products' },
      { href: '/admin/categories', label: 'Категории', icon: FolderTree, permission: 'categories' },
      { href: '/admin/groups', label: 'Группы товаров', icon: Layers, permission: 'groups' },
      { href: '/admin/import', label: 'Импорт', icon: FileUp, permission: 'import' },
    ],
  },
  {
    label: 'Маркетинг',
    items: [
      { href: '/admin/promotions', label: 'Акции', icon: Percent, permission: 'promotions' },
      { href: '/admin/modal-ads', label: 'Модальная реклама', icon: Megaphone, permission: 'modal_ads' },
      { href: '/admin/bestsellers', label: 'Топ продаж', icon: TrendingUp, permission: 'bestsellers' },
    ],
  },
  {
    label: 'Контент',
    items: [
      { href: '/admin/pages', label: 'Страницы', icon: FileText, permission: 'pages' },
      { href: '/admin/articles', label: 'Статьи', icon: Newspaper, permission: 'articles' },
      { href: '/admin/reviews', label: 'Отзывы и вопросы', icon: MessageSquare, permission: 'reviews' },
    ],
  },
  {
    label: 'Логистика',
    items: [
      { href: '/admin/delivery', label: 'Доставка', icon: Truck, permission: 'delivery' },
      { href: '/admin/payments', label: 'Платежи', icon: CreditCard, permission: 'payments' },
    ],
  },
  {
    label: 'Система',
    items: [
      { href: '/admin/users', label: 'Пользователи', icon: Shield, permission: 'users' },
      { href: '/admin/logs', label: 'Логи', icon: ScrollText, permission: 'logs' },
      { href: '/admin/settings', label: 'Настройки', icon: Settings, permission: 'settings' },
      { href: '/admin/trash', label: 'Корзина', icon: Trash2, permission: 'trash' },
    ],
  },
]

export const ALL_PERMISSIONS: { key: PermissionKey; label: string; group: string }[] =
  NAV_SECTIONS.flatMap((section) =>
    section.items.map((item) => ({
      key: item.permission,
      label: item.label,
      group: section.label,
    })),
  )

export function hasPermission(
  permissions: string[] | undefined | null,
  key: PermissionKey,
): boolean {
  if (!permissions) return false
  return permissions.includes('*') || permissions.includes(key)
}

// Map a path to the permission that guards it.
export function permissionForPath(pathname: string): PermissionKey | null {
  const clean = pathname.split('?')[0]
  // Dashboard is the exact /admin route.
  if (clean === '/admin') return 'dashboard'
  for (const section of NAV_SECTIONS) {
    for (const item of section.items) {
      if (item.href === '/admin') continue
      if (clean === item.href || clean.startsWith(item.href + '/')) return item.permission
    }
  }
  return null
}
