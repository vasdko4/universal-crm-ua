import Link from 'next/link'
import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { getShopUser } from '@/lib/session'
import { LoginForm } from '@/components/shop/auth/login-form'
import { GoogleSignInButton } from '@/components/shop/auth/google-sign-in-button'
import { getGoogleAuthEnabled } from '@/app/actions/settings-store'

export default async function LoginPage() {
  const user = await getShopUser()
  if (user) redirect('/account')

  const googleEnabled = await getGoogleAuthEnabled()

  return (
    <div className="mx-auto flex max-w-md flex-col px-4 py-12">
      <h1 className="text-2xl font-bold text-balance">Вход в аккаунт</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Нет аккаунта?{' '}
        <Link href="/account/register" className="font-medium text-primary hover:underline">
          Зарегистрироваться
        </Link>
      </p>
      <div className="mt-6">
        {googleEnabled && <GoogleSignInButton />}
        <Suspense fallback={null}>
          <LoginForm />
        </Suspense>
      </div>
    </div>
  )
}
