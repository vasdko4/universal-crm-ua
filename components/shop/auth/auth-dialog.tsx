'use client'

import { createContext, useCallback, useContext, useMemo, useState } from 'react'
import { Slot } from '@radix-ui/react-slot'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { LoginForm } from '@/components/shop/auth/login-form'
import { RegisterForm } from '@/components/shop/auth/register-form'
import { GoogleSignInButton } from '@/components/shop/auth/google-sign-in-button'

type AuthTab = 'login' | 'register'

type AuthDialogContextValue = {
  openDialog: (tab?: AuthTab) => void
  closeDialog: () => void
}

const AuthDialogContext = createContext<AuthDialogContextValue | null>(null)

export function useAuthDialog() {
  return useContext(AuthDialogContext)
}

/**
 * Holds the auth dialog state at the layout level so the dialog survives
 * client-side navigations and session refetches (previously the dialog lived
 * inside the header/nav trigger and unmounted whenever `useSession` went into
 * a pending state, closing the dialog). The dialog can only be dismissed via
 * the close (X) button.
 */
export function AuthDialogProvider({
  children,
  googleEnabled = false,
}: {
  children: React.ReactNode
  googleEnabled?: boolean
}) {
  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState<AuthTab>('login')

  const openDialog = useCallback((t: AuthTab = 'login') => {
    setTab(t)
    setOpen(true)
  }, [])
  const closeDialog = useCallback(() => setOpen(false), [])

  const value = useMemo(() => ({ openDialog, closeDialog }), [openDialog, closeDialog])

  return (
    <AuthDialogContext.Provider value={value}>
      {children}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          className="max-h-[90vh] gap-0 overflow-y-auto p-0 sm:max-w-md"
          onPointerDownOutside={(e) => e.preventDefault()}
          onInteractOutside={(e) => e.preventDefault()}
          onEscapeKeyDown={(e) => e.preventDefault()}
        >
          <DialogHeader className="px-6 pb-0 pt-6">
            <DialogTitle className="text-xl">Личный кабинет</DialogTitle>
          </DialogHeader>
          <Tabs value={tab} onValueChange={(v) => setTab(v as AuthTab)} className="w-full">
            <div className="px-6 pt-4">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="login">Вход</TabsTrigger>
                <TabsTrigger value="register">Регистрация</TabsTrigger>
              </TabsList>
            </div>
            <div className="px-6 pb-6 pt-4">
              {googleEnabled && <GoogleSignInButton />}
              <TabsContent value="login" className="mt-0">
                <LoginForm />
              </TabsContent>
              <TabsContent value="register" className="mt-0">
                <RegisterForm />
              </TabsContent>
            </div>
          </Tabs>
        </DialogContent>
      </Dialog>
    </AuthDialogContext.Provider>
  )
}

/**
 * Trigger wrapper: clicking the child opens the shared auth dialog. Kept as
 * `AuthDialog` for backwards compatibility with existing call sites.
 */
export function AuthDialog({
  children,
  defaultTab = 'login',
}: {
  children: React.ReactNode
  /** Kept for backwards compatibility; Google button is configured on the provider. */
  googleEnabled?: boolean
  defaultTab?: AuthTab
}) {
  const ctx = useAuthDialog()
  return <Slot onClick={() => ctx?.openDialog(defaultTab)}>{children}</Slot>
}
