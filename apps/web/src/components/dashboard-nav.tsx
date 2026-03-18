'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, Briefcase, Users, Settings, LogOut } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'

const navItems = [
    { href: '/dashboard', label: 'Overview', icon: LayoutDashboard },
    { href: '/dashboard/jobs', label: 'Jobs', icon: Briefcase },
    { href: '/dashboard/candidates', label: 'Candidates', icon: Users },
    { href: '/dashboard/settings', label: 'Settings', icon: Settings },
]

export function DashboardNav() {
    const pathname = usePathname()
    const router = useRouter()

    const handleSignOut = async () => {
        const { error } = await supabase.auth.signOut()
        if (error) {
            toast.error('Error signing out')
        } else {
            router.push('/login')
        }
    }

    return (
        <nav className="grid items-start gap-2 p-4 text-sm font-medium">
            {navItems.map((item) => {
                const Icon = item.icon
                return (
                    <Link
                        key={item.href}
                        href={item.href}
                        className={cn(
                            "flex items-center gap-3 rounded-lg px-3 py-2 text-muted-foreground transition-all hover:text-primary",
                            pathname === item.href && "bg-muted text-primary"
                        )}
                    >
                        <Icon className="h-4 w-4" />
                        {item.label}
                    </Link>
                )
            })}
            <Button
                variant="ghost"
                className="justify-start gap-3 px-3 text-muted-foreground hover:text-primary"
                onClick={handleSignOut}
            >
                <LogOut className="h-4 w-4" />
                Sign Out
            </Button>
        </nav>
    )
}
