import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
    return createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
}

// Singleton for client components (createBrowserClient caches by default, but we export a stable instance)
let _supabase: ReturnType<typeof createBrowserClient> | null = null

export const supabase = (() => {
    if (typeof window === 'undefined') {
        return new Proxy({} as ReturnType<typeof createBrowserClient>, {
            get(_, prop) {
                throw new Error('supabase client is only available in the browser')
            },
        })
    }
    if (!_supabase) _supabase = createClient()
    return _supabase
})()
