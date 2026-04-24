import { createContext, useContext } from 'react'
import type { User, Session } from '@supabase/supabase-js'

interface AuthContextValue {
  user: User | null
  session: Session | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<string | null>
  /**
   * Returns:
   *  - null          → success + auto-logged-in (email confirm is OFF)
   *  - 'CONFIRM_EMAIL' → account created, but email confirmation is required
   *  - any other string → error message
   */
  signUp: (email: string, password: string, name: string) => Promise<string | null>
  signOut: () => Promise<void>
}

export const AuthContext = createContext<AuthContextValue | null>(null)

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider')
  return ctx
}
