'use client'

import { useEffect, useMemo, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Briefcase, Search, User } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { searchDashboardEntities, type DashboardSearchResult } from '@/lib/actions/search'

const EMPTY_RESULTS: DashboardSearchResult = { jobs: [], candidates: [] }

export function DashboardSearch() {
    const router = useRouter()
    const [query, setQuery] = useState('')
    const [results, setResults] = useState<DashboardSearchResult>(EMPTY_RESULTS)
    const [open, setOpen] = useState(false)
    const [isPending, startTransition] = useTransition()
    const containerRef = useRef<HTMLDivElement>(null)

    const hasResults = results.jobs.length > 0 || results.candidates.length > 0
    const showDropdown = open && query.trim().length >= 2

    useEffect(() => {
        const term = query.trim()
        if (term.length < 2) {
            setResults(EMPTY_RESULTS)
            return
        }
        const timeout = setTimeout(() => {
            startTransition(async () => {
                const data = await searchDashboardEntities(term)
                setResults(data)
                setOpen(true)
            })
        }, 180)

        return () => clearTimeout(timeout)
    }, [query])

    useEffect(() => {
        const onClickOutside = (event: MouseEvent) => {
            if (!containerRef.current) return
            if (!containerRef.current.contains(event.target as Node)) {
                setOpen(false)
            }
        }
        document.addEventListener('mousedown', onClickOutside)
        return () => document.removeEventListener('mousedown', onClickOutside)
    }, [])

    const emptyMessage = useMemo(() => {
        if (isPending) return 'Searching...'
        return 'No matching jobs or candidates'
    }, [isPending])

    return (
        <div ref={containerRef} className="relative w-full md:w-2/3 lg:w-1/3">
            <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
                type="search"
                placeholder="Search jobs or candidates..."
                value={query}
                onChange={(e) => {
                    setQuery(e.target.value)
                    setOpen(true)
                }}
                onFocus={() => {
                    if (query.trim().length >= 2) setOpen(true)
                }}
                className="w-full appearance-none bg-background pl-8 shadow-none"
            />
            {showDropdown && (
                <div className="absolute left-0 top-[calc(100%+0.5rem)] z-50 w-full rounded-md border bg-background p-1 shadow-md">
                    {hasResults ? (
                        <div className="max-h-80 overflow-y-auto">
                            {results.jobs.length > 0 && (
                                <div className="pb-1">
                                    <div className="px-2 py-1 text-xs font-medium text-muted-foreground">Jobs</div>
                                    {results.jobs.map((job) => (
                                        <button
                                            key={job.id}
                                            type="button"
                                            onClick={() => {
                                                setOpen(false)
                                                router.push(`/dashboard/jobs/${job.id}`)
                                            }}
                                            className={cn(
                                                'flex w-full items-start gap-2 rounded-sm px-2 py-2 text-left text-sm hover:bg-muted'
                                            )}
                                        >
                                            <Briefcase className="mt-0.5 h-4 w-4 text-muted-foreground" />
                                            <span className="min-w-0">
                                                <span className="block truncate font-medium">{job.title}</span>
                                                <span className="block truncate text-xs text-muted-foreground">
                                                    {[job.location, job.type].filter(Boolean).join(' · ') || 'Job details'}
                                                </span>
                                            </span>
                                        </button>
                                    ))}
                                </div>
                            )}
                            {results.candidates.length > 0 && (
                                <div className="pt-1">
                                    <div className="px-2 py-1 text-xs font-medium text-muted-foreground">Candidates</div>
                                    {results.candidates.map((candidate) => (
                                        <button
                                            key={candidate.id}
                                            type="button"
                                            onClick={() => {
                                                setOpen(false)
                                                router.push(`/dashboard/jobs/${candidate.jobId}/candidates/${candidate.id}`)
                                            }}
                                            className={cn(
                                                'flex w-full items-start gap-2 rounded-sm px-2 py-2 text-left text-sm hover:bg-muted'
                                            )}
                                        >
                                            <User className="mt-0.5 h-4 w-4 text-muted-foreground" />
                                            <span className="min-w-0">
                                                <span className="block truncate font-medium">{candidate.name}</span>
                                                <span className="block truncate text-xs text-muted-foreground">
                                                    {candidate.email} · {candidate.jobTitle}
                                                    {typeof candidate.score === 'number' ? ` · ${Math.round(candidate.score)}%` : ''}
                                                </span>
                                            </span>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="px-2 py-2 text-sm text-muted-foreground">{emptyMessage}</div>
                    )}
                </div>
            )}
        </div>
    )
}
