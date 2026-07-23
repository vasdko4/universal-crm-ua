import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getShopUser } from '@/lib/session'
import { RegisterForm } from '@/components/shop/auth/register-form'
import { GoogleSignInButton } from '@/components/shop/auth/google-sign-in-button'
import { getGoogleAuthEnabled } from '@/app/actions/settings-store'
import { getServerDictionary } from '@/lib/i18n/server'

export default async function RegisterPage() {
  const user = await getShopUser()
  if (user) redirect('/account')

  const [googleEnabled, { dict: t }] = await Promise.all([
    getGoogleAuthEnabled(),
    getServerDictionary(),
  ])

  return (
    <div className="mx-auto flex max-w-md flex-col px-4 py-12">
      <h1 className="text-2xl font-bold text-balance">{t.auth.registerTitle}</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        {t.auth.registerHasAccount}{' '}
        <Link href="/account/login" className="font-medium text-primary hover:underline">
          {t.auth.registerLoginLink}
        </Link>
      </p>
      <div className="mt-6">
        {googleEnabled && <GoogleSignInButton />}
        <RegisterForm />
      </div>
    </div>
  )
}
