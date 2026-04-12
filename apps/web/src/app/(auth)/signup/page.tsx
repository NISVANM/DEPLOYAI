'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import { Button } from '@/components/ui/button'
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import Link from 'next/link'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'

const credentialsSchema = z
    .object({
        email: z.string().email(),
        password: z.string().min(6),
        confirmPassword: z.string().min(6),
    })
    .refine((data) => data.password === data.confirmPassword, {
        message: "Passwords don't match",
        path: ['confirmPassword'],
    })

const otpSchema = z.object({
    code: z
        .string()
        .min(1, 'Enter the code from your email')
        .refine((val) => /^\d{8}$/.test(val.replace(/\s/g, '')), 'Code must be 8 digits'),
})

export default function SignupPage() {
    const router = useRouter()
    const [step, setStep] = useState<'credentials' | 'otp'>('credentials')
    const [registeredEmail, setRegisteredEmail] = useState('')
    const [resendCooldown, setResendCooldown] = useState(0)
    /** Local OTP state avoids WebKit + react-hook-form Controller fighting on each keystroke. */
    const [otpCode, setOtpCode] = useState('')
    const otpInputRef = useRef<HTMLInputElement>(null)

    const credentialsForm = useForm<z.infer<typeof credentialsSchema>>({
        resolver: zodResolver(credentialsSchema),
        defaultValues: {
            email: '',
            password: '',
            confirmPassword: '',
        },
    })

    const startResendCooldown = useCallback(() => {
        setResendCooldown(60)
    }, [])

    useEffect(() => {
        if (resendCooldown <= 0) return
        const id = window.setTimeout(() => setResendCooldown((c) => Math.max(0, c - 1)), 1000)
        return () => clearTimeout(id)
    }, [resendCooldown])

    useEffect(() => {
        if (step !== 'otp') return
        const id = requestAnimationFrame(() => otpInputRef.current?.focus())
        return () => cancelAnimationFrame(id)
    }, [step])

    async function onSubmitCredentials(values: z.infer<typeof credentialsSchema>) {
        const { data, error } = await supabase.auth.signUp({
            email: values.email,
            password: values.password,
            options: {
                emailRedirectTo: `${location.origin}/auth/callback`,
            },
        })

        if (error) {
            toast.error(error.message)
            return
        }

        if (data.session) {
            toast.success('Account created')
            router.replace('/dashboard')
            router.refresh()
            return
        }

        setRegisteredEmail(values.email)
        setOtpCode('')
        setStep('otp')
        toast.success('We sent a verification code to your email. Enter it below.')
        startResendCooldown()
    }

    async function onSubmitOtp(e: FormEvent<HTMLFormElement>) {
        e.preventDefault()
        const parsed = otpSchema.safeParse({ code: otpCode })
        if (!parsed.success) {
            toast.error(parsed.error.issues[0]?.message ?? 'Invalid code')
            return
        }
        const token = parsed.data.code.replace(/\s/g, '')
        const { data, error } = await supabase.auth.verifyOtp({
            email: registeredEmail,
            token,
            type: 'email',
        })

        if (error) {
            toast.error(error.message)
            return
        }

        toast.success('Email verified')
        if (data.session) {
            router.replace('/dashboard')
            router.refresh()
        } else {
            router.push('/login')
        }
    }

    async function resendCode() {
        if (resendCooldown > 0 || !registeredEmail) return
        const { error } = await supabase.auth.resend({
            type: 'signup',
            email: registeredEmail,
            options: {
                emailRedirectTo: `${location.origin}/auth/callback`,
            },
        })
        if (error) {
            toast.error(error.message)
            return
        }
        toast.success('We sent a new code')
        startResendCooldown()
    }

    function backToCredentials() {
        setStep('credentials')
        setRegisteredEmail('')
        setOtpCode('')
    }

    return (
        <div className="flex min-h-screen items-center justify-center bg-muted/50 p-4">
            <Card className="w-full max-w-sm">
                <CardHeader>
                    <CardTitle className="text-2xl">{step === 'credentials' ? 'Sign Up' : 'Verify email'}</CardTitle>
                    <CardDescription>
                        {step === 'credentials'
                            ? 'Create an account to start screening candidates.'
                            : `Enter the verification code we sent to ${registeredEmail}`}
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {step === 'credentials' ? (
                        <Form {...credentialsForm}>
                            <form onSubmit={credentialsForm.handleSubmit(onSubmitCredentials)} className="space-y-4">
                                <FormField
                                    control={credentialsForm.control}
                                    name="email"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Email</FormLabel>
                                            <FormControl>
                                                <Input placeholder="m@example.com" autoComplete="email" {...field} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={credentialsForm.control}
                                    name="password"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Password</FormLabel>
                                            <FormControl>
                                                <Input type="password" autoComplete="new-password" {...field} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={credentialsForm.control}
                                    name="confirmPassword"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Confirm Password</FormLabel>
                                            <FormControl>
                                                <Input type="password" autoComplete="new-password" {...field} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <Button type="submit" className="w-full">
                                    Sign Up
                                </Button>
                            </form>
                        </Form>
                    ) : (
                        <form onSubmit={onSubmitOtp} className="space-y-4">
                            <div className="grid gap-2">
                                <Label htmlFor="signup-otp-code">Verification code</Label>
                                <Input
                                    ref={otpInputRef}
                                    id="signup-otp-code"
                                    name="verification-code"
                                    type="text"
                                    inputMode="numeric"
                                    autoComplete="off"
                                    autoCorrect="off"
                                    spellCheck={false}
                                    maxLength={8}
                                    placeholder="00000000"
                                    className="text-center text-lg tracking-widest tabular-nums"
                                    value={otpCode}
                                    onChange={(e) => {
                                        const next = e.target.value.replace(/\D/g, '').slice(0, 8)
                                        setOtpCode(next)
                                    }}
                                />
                            </div>
                            <Button type="submit" className="w-full">
                                Verify & continue
                            </Button>
                            <div className="flex flex-col gap-2 text-center text-sm">
                                <button
                                    type="button"
                                    className="text-muted-foreground underline disabled:opacity-50"
                                    disabled={resendCooldown > 0}
                                    onClick={resendCode}
                                >
                                    {resendCooldown > 0 ? `Resend code in ${resendCooldown}s` : 'Resend code'}
                                </button>
                                <button type="button" className="text-muted-foreground underline" onClick={backToCredentials}>
                                    Wrong email? Start over
                                </button>
                            </div>
                        </form>
                    )}
                </CardContent>
                <CardFooter className="flex justify-center">
                    <p className="text-sm text-muted-foreground">
                        Already have an account?{' '}
                        <Link href="/login" className="underline hover:text-primary">
                            Login
                        </Link>
                    </p>
                </CardFooter>
            </Card>
        </div>
    )
}
