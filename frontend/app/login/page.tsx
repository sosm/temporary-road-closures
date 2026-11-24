"use client"
import React, { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import {
    LogIn, Construction, ArrowLeft, AlertCircle,
    Eye, EyeOff, XCircle, Loader2, Lock, User
} from 'lucide-react';
import { ClosuresProvider, useClosures } from '@/context/ClosuresContext';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

interface LoginFormData {
    username: string;
    password: string;
}

function LoginContent() {
    const { login, state } = useClosures();
    const { loading, isAuthenticated } = state;
    const [showPassword, setShowPassword] = useState(false);
    const [loginAttempts, setLoginAttempts] = useState(0);
    const router = useRouter();
    const searchParams = useSearchParams();
    const redirectTo = searchParams.get('redirect') || '/';
    const oauthError = searchParams.get('error');
    const oauthReason = searchParams.get('reason');

    const {
        register,
        handleSubmit,
        formState: { errors },
        setValue,
        setError,
        clearErrors,
    } = useForm<LoginFormData>();

    useEffect(() => {
        if (isAuthenticated) {
            toast.success('Already logged in! Redirecting...');
            router.push(redirectTo);
        }
    }, [isAuthenticated, router, redirectTo]);

    useEffect(() => {
        if (oauthError) {
            const reasonMessages: Record<string, string> = {
                'authentication_failed': 'Authentication failed. Please try again.',
                'missing_parameters': 'OAuth callback was missing required parameters.',
                'missing_state': 'OAuth session expired. Please try again.',
                'invalid_state': 'OAuth security validation failed. Please try again.',
            };
            const message = oauthReason
                ? reasonMessages[oauthReason] || `OAuth login failed: ${oauthReason}`
                : 'OAuth login failed. Please try again.';
            toast.error(message, { duration: 6000 });
        }
    }, [oauthError, oauthReason]);

    useEffect(() => {
        if (loginAttempts >= 3) {
            toast.error('Multiple login failures. Please check your credentials or reset your password.', {
                duration: 5000, icon: '⚠️'
            });
        }
    }, [loginAttempts]);

    const onSubmit = async (data: LoginFormData) => {
        try {
            clearErrors();
            const loadingToast = toast.loading('Signing you in...');
            await login(data.username, data.password);
            toast.dismiss(loadingToast);
            setLoginAttempts(0);
        } catch (error: any) {
            setLoginAttempts(prev => prev + 1);
            const errorMessage = error?.message || 'Login failed';
            const statusCode = error?.response?.status || error?.status || 0;

            if (statusCode === 401 || errorMessage.toLowerCase().includes('incorrect') || errorMessage.toLowerCase().includes('invalid')) {
                setError('username', { type: 'manual', message: 'Invalid username or password' });
                setError('password', { type: 'manual', message: 'Invalid username or password' });
                toast.error('Invalid username or password. Please try again.', { icon: '🔒', duration: 4000 });
            } else if (statusCode === 404 || errorMessage.toLowerCase().includes('not found')) {
                setError('username', { type: 'manual', message: 'User not found' });
                toast.error('User not found. Please check your username or create an account.', { icon: '👤', duration: 4000 });
            } else if (errorMessage.toLowerCase().includes('inactive') || errorMessage.toLowerCase().includes('disabled')) {
                toast.error('This account has been disabled. Please contact support.', { icon: '⛔', duration: 5000 });
            } else if (errorMessage.includes('network') || errorMessage.includes('timeout')) {
                toast.error('Network error. Please check your connection and try again.', { icon: '🌐', duration: 4000 });
            } else {
                toast.error(errorMessage || 'Login failed. Please try again.', { icon: '❌', duration: 4000 });
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

            {/* Card */}
            <div className="sm:mx-auto sm:w-full sm:max-w-md">
                <Card className="shadow-sm border border-gray-100 rounded-3xl">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-2xl font-bold text-center">Sign in</CardTitle>
                        <CardDescription className="text-center">
                            Don't have an account?{' '}
                            <Link
                                href={`/register${redirectTo !== '/' ? `?redirect=${encodeURIComponent(redirectTo)}` : ''}`}
                                className="font-medium text-blue-600 hover:text-blue-500 hover:underline"
                            >
                                Sign up
                            </Link>
                        </CardDescription>
                    </CardHeader>

                    <CardContent className="space-y-5">
                        {/* OAuth Error */}
                        {oauthError && (
                            <Alert variant="destructive">
                                <XCircle className="h-4 w-4" />
                                <AlertTitle>OAuth login failed</AlertTitle>
                                <AlertDescription>
                                    {oauthReason && <span className="block text-xs">Reason: {oauthReason.replace(/_/g, ' ')}</span>}
                                    Please try again or use username and password.
                                </AlertDescription>
                            </Alert>
                        )}

                        {/* Login attempts warning */}
                        {loginAttempts > 0 && loginAttempts < 3 && (
                            <Alert className="border-yellow-200 bg-yellow-50 text-yellow-800">
                                <AlertCircle className="h-4 w-4 !text-yellow-600" />
                                <AlertTitle>Login attempt {loginAttempts} of 3</AlertTitle>
                                <AlertDescription>Please ensure you're using the correct credentials.</AlertDescription>
                            </Alert>
                        )}

                        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                            {/* Username */}
                            <div className="space-y-1.5">
                                <Label htmlFor="username" className="flex items-center gap-1.5 text-sm font-medium">
                                    <User className="w-3.5 h-3.5" />
                                    Username
                                </Label>
                                <Input
                                    id="username"
                                    type="text"
                                    autoComplete="username"
                                    placeholder="Enter your username"
                                    className={`h-11 ${errors.username ? 'border-red-400 focus-visible:ring-red-400' : ''}`}
                                    {...register('username', {
                                        required: 'Username is required',
                                        minLength: { value: 3, message: 'Username must be at least 3 characters' },
                                        onChange: () => { clearErrors('username'); clearErrors('password'); }
                                    })}
                                />
                                {errors.username && (
                                    <p className="flex items-center gap-1 text-xs text-red-600 font-medium">
                                        <XCircle className="w-3.5 h-3.5" />
                                        {errors.username.message}
                                    </p>
                                )}
                            </div>

                            {/* Password */}
                            <div className="space-y-1.5">
                                <Label htmlFor="password" className="flex items-center gap-1.5 text-sm font-medium">
                                    <Lock className="w-3.5 h-3.5" />
                                    Password
                                </Label>
                                <div className="relative">
                                    <Input
                                        id="password"
                                        type={showPassword ? 'text' : 'password'}
                                        autoComplete="current-password"
                                        placeholder="Enter your password"
                                        className={`h-11 pr-11 ${errors.password ? 'border-red-400 focus-visible:ring-red-400' : ''}`}
                                        {...register('password', {
                                            required: 'Password is required',
                                            minLength: { value: 6, message: 'Password must be at least 6 characters' },
                                            onChange: () => { clearErrors('password'); clearErrors('username'); }
                                        })}
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="absolute inset-y-0 right-0 pr-4 flex items-center text-muted-foreground hover:text-foreground transition-colors"
                                        title={showPassword ? 'Hide password' : 'Show password'}
                                    >
                                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                    </button>
                                </div>
                                {errors.password && (
                                    <p className="flex items-center gap-1 text-xs text-red-600 font-medium">
                                        <XCircle className="w-3.5 h-3.5" />
                                        {errors.password.message}
                                    </p>
                                )}
                            </div>

                            {/* Help text */}
                            <Alert className="bg-blue-50/50 border-blue-200 text-blue-800">
                                <AlertCircle className="h-4 w-4 !text-blue-600" />
                                <AlertTitle>Need Help?</AlertTitle>
                                <AlertDescription>
                                    <ul className="text-xs space-y-1 list-disc list-inside mt-1 text-blue-700">
                                        <li>Usernames are case-sensitive</li>
                                        <li>Check that Caps Lock is not enabled</li>
                                        <li>Passwords must be at least 6 characters</li>
                                    </ul>
                                </AlertDescription>
                            </Alert>

                            {/* Submit */}
                            <Button
                                type="submit"
                                disabled={loading}
                                className="w-full h-11 rounded-full bg-blue-600 hover:bg-blue-700 font-bold uppercase tracking-widest text-sm shadow-md active:scale-[0.98] transition-transform"
                            >
                                {loading ? (
                                    <>
                                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                        Signing in...
                                    </>
                                ) : (
                                    <>
                                        <LogIn className="w-4 h-4 mr-2" />
                                        Sign in
                                    </>
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

                        {/* OAuth Buttons */}
                        <div className="space-y-2">
                            <a
                                href={`${API_BASE_URL}/api/v1/auth/oauth/osm${redirectTo !== '/' ? `?redirect=${encodeURIComponent(redirectTo)}` : ''}`}
                                className={oauthButtonClass}
                            >
			        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                                    <circle cx="14.25" cy="9" r="6.5" fill="none" stroke="#7ebc6f" stroke-width="3"/>
                                    <path d="M9.5 13.75l-5.75 5.75" stroke="#7ebc6f" stroke-width="3.5" stroke-linecap="round"/>
                               </svg>
                                Continue with OpenStreetMap
                            </a>
                        </div>

                        {/* Back */}
                        <div className="text-center pt-1">
                            <Link
                                href="/"
                                className="inline-flex items-center gap-1 px-4 py-1.5 rounded-full text-sm text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                            >
                                <ArrowLeft className="w-3.5 h-3.5" />
                                Back to Home
                            </Link>
                        </div>
                    </CardContent>
                </Card>

                <p className="mt-6 text-center text-xs text-muted-foreground">
                    🔒 Your credentials are securely transmitted and stored
                </p>
            </div>
        </div>
    );
}

export default function LoginPage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <Loader2 className="h-10 w-10 animate-spin text-blue-600" />
            </div>
        }>
            <LoginContent />
        </Suspense>
    );
}
