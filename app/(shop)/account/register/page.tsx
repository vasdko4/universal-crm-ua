import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getShopUser } from '@/lib/session'
import { RegisterForm } from '@/components/shop/auth/register-form'
import { GoogleSignInButton } from '@/components/shop/auth/google-sign-in-button'
import { getGoogleAuthEnabled } from '@/app/actions/settings-store'

export default async function RegisterPage() {
  const user = await getShopUser()
  if (user) redirect('/account')

  const googleEnabled = await getGoogleAuthEnabled()

  return (
    <div className="mx-auto flex max-w-md flex-col px-4 py-12">
      <h1 className="text-2xl font-bold text-balance">Создать аккаунт</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Уже есть аккаунт?{' '}
        <Link href="/account/login" className="font-medium text-primary hover:underline">
          Войти
        </Link>
      </p>
      <div className="mt-6">
        {googleEnabled && <GoogleSignInButton />}
        <RegisterForm />
      </div>
    </div>
  )
}
