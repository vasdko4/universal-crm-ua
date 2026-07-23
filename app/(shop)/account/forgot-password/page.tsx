import Link from 'next/link'
import { ForgotPasswordForm } from '@/components/shop/auth/forgot-password-form'
import { getServerDictionary } from '@/lib/i18n/server'

export default async function ForgotPasswordPage() {
  const { dict: t } = await getServerDictionary()

  return (
    <div className="mx-auto flex max-w-md flex-col px-4 py-12">
      <h1 className="text-2xl font-bold text-balance">{t.auth.forgotTitle}</h1>
      <p className="mt-2 text-sm text-muted-foreground text-pretty">{t.auth.forgotDescription}</p>
      <div className="mt-6">
        <ForgotPasswordForm />
      </div>
      <p className="mt-6 text-sm text-muted-foreground">
        {t.auth.forgotBackToLogin}{' '}
        <Link href="/account/login" className="font-medium text-primary hover:underline">
          {t.auth.registerLoginLink}
        </Link>
      </p>
    </div>
  )
}
