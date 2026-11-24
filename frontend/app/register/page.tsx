"use client"
import React, { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import {
    UserPlus, Construction, ArrowLeft, Eye, EyeOff,
    User, Mail, Lock, CheckCircle, XCircle, AlertCircle, Info, Loader2
} from 'lucide-react';
import { useClosures } from '@/context/ClosuresContext';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

interface RegisterFormData {
    username: string;
    email: string;
    full_name: string;
    password: string;
    confirmPassword: string;
}

interface PasswordRequirement {
    label: string;
    validator: (password: string) => boolean;
    met: boolean;
}

function RegisterContent() {
    const { register: registerUser, login, state } = useClosures();
    const { loading, isAuthenticated } = state;
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [passwordFocused, setPasswordFocused] = useState(false);
    const router = useRouter();
    const searchParams = useSearchParams();
    const redirectTo = searchParams.get('redirect') || '/';

    const {
        register,
        handleSubmit,
        formState: { errors },
        watch,
        setError,
        clearErrors,
    } = useForm<RegisterFormData>();

    const password = watch('password');
    const username = watch('username');
    const email = watch('email');

    const [passwordRequirements, setPasswordRequirements] = useState<PasswordRequirement[]>([
        { label: 'At least 8 characters', validator: (p) => p.length >= 8, met: false },
        { label: 'At least one uppercase letter (A-Z)', validator: (p) => /[A-Z]/.test(p), met: false },
        { label: 'At least one lowercase letter (a-z)', validator: (p) => /[a-z]/.test(p), met: false },
        { label: 'At least one number (0-9)', validator: (p) => /\d/.test(p), met: false },
        { label: 'At least one special character (!@#$%^&*)', validator: (p) => /[!@#$%^&*(),.?":{}|<>]/.test(p), met: false },
    ]);

    useEffect(() => {
        if (password) {
            setPasswordRequirements(prev => prev.map(req => ({ ...req, met: req.validator(password) })));
        } else {
            setPasswordRequirements(prev => prev.map(req => ({ ...req, met: false })));
        }
    }, [password]);

    const allRequirementsMet = passwordRequirements.every(req => req.met);

    useEffect(() => {
        if (isAuthenticated) {
            toast.success('Already logged in! Redirecting...');
            router.push(redirectTo);
        }
    }, [isAuthenticated, router, redirectTo]);

    const onSubmit = async (data: RegisterFormData) => {
        try {
            clearErrors();
            if (!allRequirementsMet) {
                setError('password', { type: 'manual', message: 'Password does not meet all requirements' });
                toast.error('Please ensure your password meets all requirements', { icon: '🔒', duration: 4000 });
                return;
            }
            const loadingToast = toast.loading('Creating your account...');
            await registerUser({ username: data.username, email: data.email, full_name: data.full_name, password: data.password });
            toast.dismiss(loadingToast);
            toast.success('🎉 Account created successfully!', { duration: 3000 });
            const loginToast = toast.loading('Logging you in automatically...');
            await login(data.username, data.password);
            toast.dismiss(loginToast);
        } catch (error: any) {
            const errorMessage = error?.message || 'Registration failed';
            const statusCode = error?.response?.status || error?.status || 0;
            if (statusCode === 409 || errorMessage.includes('already exists') || errorMessage.includes('already registered')) {
                const lowerMessage = errorMessage.toLowerCase();
                if (lowerMessage.includes('username')) {
                    setError('username', { type: 'manual', message: 'This username is already taken' });
                    toast.error('This username is already taken.', { icon: '👤', duration: 5000 });
                } else if (lowerMessage.includes('email')) {
                    setError('email', { type: 'manual', message: 'This email is already registered' });
                    toast.error('This email is already registered.', { icon: '📧', duration: 5000 });
                } else {
                    toast.error(errorMessage || 'Username or email already exists.', { icon: '⚠️', duration: 5000 });
                }
            } else if (statusCode === 422 || errorMessage.includes('validation')) {
                toast.error('Please check your input data and try again.', { icon: '❌', duration: 4000 });
            } else if (errorMessage.includes('network') || errorMessage.includes('timeout')) {
                toast.error('Network error. Please check your connection.', { icon: '🌐', duration: 4000 });
            } else {
                toast.error(errorMessage || 'Registration failed. Please try again.', { icon: '❌', duration: 4000 });
            }
        }
    };

    if (isAuthenticated) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="text-center space-y-3">
                    <Loader2 className="h-10 w-10 animate-spin text-blue-600 mx-auto" />
                    <p className="text-sm text-muted-foreground">Redirecting...</p>
                </div>
            </div>
        );
    }

    const inputClass = (hasError: boolean) =>
        `h-11 pl-10 ${hasError ? 'border-red-400 focus-visible:ring-red-400' : ''}`;

    const oauthButtonClass =
        "w-full inline-flex justify-center items-center gap-2 py-2.5 px-4 border border-input rounded-full bg-background text-sm font-medium hover:bg-accent hover:text-accent-foreground transition-colors shadow-sm";

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">

            {/* Branding */}
            <div className="sm:mx-auto sm:w-full sm:max-w-md text-center mb-6">
                <Link href="/" className="inline-flex flex-col items-center gap-2 mb-4">
                    <div className="flex items-center justify-center w-12 h-12 bg-blue-600 rounded-full shadow-md">
                        <Construction className="w-7 h-7 text-white" />
                    </div>
                    <span className="text-2xl font-bold text-gray-900 tracking-tight">OSM Road Closures</span>
                </Link>
            </div>

            <div className="sm:mx-auto sm:w-full sm:max-w-md">
                <Card className="shadow-sm border border-gray-100 rounded-3xl">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-2xl font-bold text-center">Create account</CardTitle>
                        <CardDescription className="text-center">
                            Already have an account?{' '}
                            <Link
                                href={`/login${redirectTo !== '/' ? `?redirect=${encodeURIComponent(redirectTo)}` : ''}`}
                                className="font-medium text-blue-600 hover:text-blue-500 hover:underline"
                            >
                                Sign in
                            </Link>
                        </CardDescription>
                    </CardHeader>

                    <CardContent className="space-y-4">
                        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">

                            {/* Full Name */}
                            <div className="space-y-1.5">
                                <Label htmlFor="full_name" className="flex items-center gap-1.5 text-sm font-medium">
                                    <User className="w-3.5 h-3.5" /> Full Name <span className="text-red-500">*</span>
                                </Label>
                                <div className="relative">
                                    <User className="absolute left-3.5 top-3 h-4 w-4 text-muted-foreground" />
                                    <Input id="full_name" type="text" autoComplete="name" placeholder="Enter your full name"
                                        className={inputClass(!!errors.full_name)}
                                        {...register('full_name', {
                                            required: 'Full name is required',
                                            minLength: { value: 2, message: 'At least 2 characters' },
                                            maxLength: { value: 100, message: 'Max 100 characters' },
                                            onChange: () => clearErrors('full_name')
                                        })} />
                                </div>
                                {errors.full_name && (
                                    <p className="flex items-center gap-1 text-xs text-red-600 font-medium">
                                        <XCircle className="w-3.5 h-3.5" />{errors.full_name.message}
                                    </p>
                                )}
                            </div>

                            {/* Username */}
                            <div className="space-y-1.5">
                                <Label htmlFor="username" className="flex items-center gap-1.5 text-sm font-medium">
                                    <User className="w-3.5 h-3.5" /> Username <span className="text-red-500">*</span>
                                </Label>
                                <div className="relative">
                                    <User className="absolute left-3.5 top-3 h-4 w-4 text-muted-foreground" />
                                    <Input id="username" type="text" autoComplete="username" placeholder="Choose a unique username"
                                        className={inputClass(!!errors.username)}
                                        {...register('username', {
                                            required: 'Username is required',
                                            minLength: { value: 3, message: 'At least 3 characters' },
                                            maxLength: { value: 30, message: 'Max 30 characters' },
                                            pattern: { value: /^[a-zA-Z0-9_]+$/, message: 'Letters, numbers, and underscores only' },
                                            onChange: () => clearErrors('username')
                                        })} />
                                </div>
                                {errors.username ? (
                                    <p className="flex items-center gap-1 text-xs text-red-600 font-medium">
                                        <XCircle className="w-3.5 h-3.5" />{errors.username.message}
                                    </p>
                                ) : username && username.length >= 3 && (
                                    <p className="flex items-center gap-1 text-xs text-green-600 font-medium">
                                        <CheckCircle className="w-3.5 h-3.5" />Username format is valid
                                    </p>
                                )}
                            </div>

                            {/* Email */}
                            <div className="space-y-1.5">
                                <Label htmlFor="email" className="flex items-center gap-1.5 text-sm font-medium">
                                    <Mail className="w-3.5 h-3.5" /> Email Address <span className="text-red-500">*</span>
                                </Label>
                                <div className="relative">
                                    <Mail className="absolute left-3.5 top-3 h-4 w-4 text-muted-foreground" />
                                    <Input id="email" type="email" autoComplete="email" placeholder="Enter your email address"
                                        className={inputClass(!!errors.email)}
                                        {...register('email', {
                                            required: 'Email is required',
                                            pattern: { value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i, message: 'Invalid email address' },
                                            onChange: () => clearErrors('email')
                                        })} />
                                </div>
                                {errors.email ? (
                                    <p className="flex items-center gap-1 text-xs text-red-600 font-medium">
                                        <XCircle className="w-3.5 h-3.5" />{errors.email.message}
                                    </p>
                                ) : email && email.includes('@') && email.includes('.') && (
                                    <p className="flex items-center gap-1 text-xs text-green-600 font-medium">
                                        <CheckCircle className="w-3.5 h-3.5" />Email format is valid
                                    </p>
                                )}
                            </div>

                            {/* Password */}
                            <div className="space-y-1.5">
                                <Label htmlFor="password" className="flex items-center gap-1.5 text-sm font-medium">
                                    <Lock className="w-3.5 h-3.5" /> Password <span className="text-red-500">*</span>
                                </Label>
                                <div className="relative">
                                    <Lock className="absolute left-3.5 top-3 h-4 w-4 text-muted-foreground" />
                                    <Input id="password" type={showPassword ? 'text' : 'password'}
                                        autoComplete="new-password" placeholder="Create a strong password"
                                        className={`${inputClass(!!errors.password)} pr-11`}
                                        onFocus={() => setPasswordFocused(true)}
                                        onBlur={() => setPasswordFocused(false)}
                                        {...register('password', {
                                            required: 'Password is required',
                                            minLength: { value: 8, message: 'At least 8 characters' },
                                            validate: {
                                                hasUpperCase: (v) => /[A-Z]/.test(v) || 'Need uppercase letter',
                                                hasLowerCase: (v) => /[a-z]/.test(v) || 'Need lowercase letter',
                                                hasNumber: (v) => /\d/.test(v) || 'Need a number',
                                                hasSpecialChar: (v) => /[!@#$%^&*(),.?":{}|<>]/.test(v) || 'Need special character',
                                            },
                                            onChange: () => clearErrors('password')
                                        })} />
                                    <button type="button" onClick={() => setShowPassword(!showPassword)}
                                        className="absolute inset-y-0 right-0 pr-4 flex items-center text-muted-foreground hover:text-foreground transition-colors">
                                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                    </button>
                                </div>

                                {/* Password requirements */}
                                {(passwordFocused || password) && (
                                    <div className="p-3 bg-muted/50 border border-border rounded-xl text-xs space-y-1">
                                        <p className="font-medium text-muted-foreground flex items-center gap-1 mb-2">
                                            <Info className="w-3 h-3" /> Password Requirements:
                                        </p>
                                        {passwordRequirements.map((req, i) => (
                                            <div key={i} className={`flex items-center gap-1.5 ${req.met ? 'text-green-600' : 'text-muted-foreground'}`}>
                                                {req.met
                                                    ? <CheckCircle className="w-3 h-3 flex-shrink-0" />
                                                    : <XCircle className="w-3 h-3 flex-shrink-0 opacity-40" />}
                                                {req.label}
                                            </div>
                                        ))}
                                    </div>
                                )}
                                {errors.password && (
                                    <p className="flex items-center gap-1 text-xs text-red-600 font-medium">
                                        <XCircle className="w-3.5 h-3.5" />{errors.password.message}
                                    </p>
                                )}
                            </div>

                            {/* Confirm Password */}
                            <div className="space-y-1.5">
                                <Label htmlFor="confirmPassword" className="flex items-center gap-1.5 text-sm font-medium">
                                    <Lock className="w-3.5 h-3.5" /> Confirm Password <span className="text-red-500">*</span>
                                </Label>
                                <div className="relative">
                                    <Lock className="absolute left-3.5 top-3 h-4 w-4 text-muted-foreground" />
                                    <Input id="confirmPassword" type={showConfirmPassword ? 'text' : 'password'}
                                        autoComplete="new-password" placeholder="Confirm your password"
                                        className={`${inputClass(!!errors.confirmPassword)} pr-11`}
                                        {...register('confirmPassword', {
                                            required: 'Please confirm your password',
                                            validate: (value) => value === password || 'Passwords do not match',
                                            onChange: () => clearErrors('confirmPassword')
                                        })} />
                                    <button type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                        className="absolute inset-y-0 right-0 pr-4 flex items-center text-muted-foreground hover:text-foreground transition-colors">
                                        {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                    </button>
                                </div>
                                {errors.confirmPassword ? (
                                    <p className="flex items-center gap-1 text-xs text-red-600 font-medium">
                                        <XCircle className="w-3.5 h-3.5" />{errors.confirmPassword.message}
                                    </p>
                                ) : watch('confirmPassword') && watch('confirmPassword') === password && (
                                    <p className="flex items-center gap-1 text-xs text-green-600 font-medium">
                                        <CheckCircle className="w-3.5 h-3.5" />Passwords match
                                    </p>
                                )}
                            </div>

                            {/* Important info */}
                            <Alert className="bg-blue-50/50 border-blue-200 text-blue-800">
                                <AlertCircle className="h-4 w-4 !text-blue-600" />
                                <AlertTitle>Important</AlertTitle>
                                <AlertDescription>
                                    <ul className="text-xs space-y-1 list-disc list-inside mt-1 text-blue-700">
                                        <li>Choose a unique username (cannot be changed later)</li>
                                        <li>Use a valid email for account recovery</li>
                                        <li>Keep your password secure</li>
                                    </ul>
                                </AlertDescription>
                            </Alert>

                            {/* Submit */}
                            <Button
                                type="submit"
                                disabled={loading || !allRequirementsMet}
                                className="w-full h-11 rounded-full bg-blue-600 hover:bg-blue-700 font-bold uppercase tracking-widest text-sm shadow-md active:scale-[0.98] transition-transform"
                            >
                                {loading ? (
                                    <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Creating account...</>
                                ) : (
                                    <><UserPlus className="w-4 h-4 mr-2" />Create account</>
                                )}
                            </Button>
                        </form>

                        {/* Divider */}
                        <div className="relative">
                            <Separator />
                            <span className="absolute inset-0 flex items-center justify-center">
                                <span className="px-3 bg-white text-xs text-muted-foreground">Or</span>
                            </span>
                        </div>

                        {/* OAuth */}
                        <div className="space-y-2">
                            <a href={`${API_BASE_URL}/api/v1/auth/oauth/osm${redirectTo !== '/' ? `?redirect=${encodeURIComponent(redirectTo)}` : ''}`} className={oauthButtonClass}>
			        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                                    <circle cx="14.25" cy="9" r="6.5" fill="none" stroke="#7ebc6f" stroke-width="3"/>
                                    <path d="M9.5 13.75l-5.75 5.75" stroke="#7ebc6f" stroke-width="3.5" stroke-linecap="round"/>
                                </svg>
                                Sign up with OpenStreetMap
                            </a>
                        </div>

                        {/* Back */}
                        <div className="text-center pt-1">
                            <Link href="/" className="inline-flex items-center gap-1 px-4 py-1.5 rounded-full text-sm text-muted-foreground hover:text-foreground hover:bg-accent transition-colors">
                                <ArrowLeft className="w-3.5 h-3.5" />
                                Back to Home
                            </Link>
                        </div>
                    </CardContent>
                </Card>

                <p className="mt-6 text-center text-xs text-muted-foreground">
                    By creating an account, you agree to contribute to the OpenStreetMap community.<br />
                    🔒 Your data is securely encrypted and protected
                </p>
            </div>
        </div>
    );
}

export default function RegisterPage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <Loader2 className="h-10 w-10 animate-spin text-blue-600" />
            </div>
        }>
            <RegisterContent />
        </Suspense>
    );
}
