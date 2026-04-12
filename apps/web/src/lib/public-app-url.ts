/** Absolute base URL for links (emails, scheduling tokens). Not a server action. */
export function getPublicAppBaseUrl(): string {
    if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, '')
    if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL.replace(/\/$/, '')}`
    return 'http://localhost:3000'
}
