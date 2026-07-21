import Link from 'next/link'
import { ForgotPasswordForm } from '@/components/shop/auth/forgot-password-form'

export default function ForgotPasswordPage() {
  return (
    <div className="mx-auto flex max-w-md flex-col px-4 py-12">
      <h1 className="text-2xl font-bold text-balance">Восстановление пароля</h1>
      <p className="mt-2 text-sm text-muted-foreground text-pretty">
        Введите почту — мы отправим код для сброса пароля. Код действует 15 минут.
      </p>
      <div className="mt-6">
        <ForgotPasswordForm />
      </div>
      <p className="mt-6 text-sm text-muted-foreground">
        Вспомнили пароль?{' '}
        <Link href="/account/login" className="font-medium text-primary hover:underline">
          Войти
        </Link>
      </p>
    </div>
  )
}
