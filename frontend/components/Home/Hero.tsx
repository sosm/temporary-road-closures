import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { ArrowRight, MapPin, AlertTriangle, Users, Zap } from 'lucide-react';

const Hero: React.FC = () => {
    const [currentStep, setCurrentStep] = useState(0);
    const [isAnimating, setIsAnimating] = useState(true);

    const animationSteps = [
        {
            title: "Report Incident",
            description: "Community member spots a road closure",
            icon: AlertTriangle,
            color: "text-red-500",
            bgColor: "bg-red-100"
        },
        {
            title: "Live Update",
            description: "Information is instantly available to everyone",
            icon: Zap,
            color: "text-yellow-500",
            bgColor: "bg-yellow-100"
        },
        {
            title: "Navigation",
            description: "Apps can route around the closure",
            icon: MapPin,
            color: "text-green-500",
            bgColor: "bg-green-100"
        },
        {
            title: "Community",
            description: "OpenStreetMap ecosystem benefits",
            icon: Users,
            color: "text-blue-500",
            bgColor: "bg-blue-100"
        }
    ];

    useEffect(() => {
        if (!isAnimating) return;

        const interval = setInterval(() => {
            setCurrentStep((prev) => (prev + 1) % animationSteps.length);
        }, 2000);

        return () => clearInterval(interval);
    }, [isAnimating, animationSteps.length]);

    return (
        <section className="relative bg-gradient-to-br from-blue-50 via-white to-indigo-50 py-20 lg:py-32 overflow-hidden">
            {/* Background decoration */}
            <div className="absolute inset-0 bg-grid-slate-100 [mask-image:linear-gradient(0deg,#fff,rgba(255,255,255,0.6))] -z-10"></div>

            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
                    {/* Content */}
                    <div className="text-center lg:text-left">

                        <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-gray-900 leading-tight mb-6">
                            Real-time Road
                            <span className="text-blue-600 block">Closure Reporting</span>
                        </h1>

                        <p className="text-xl text-gray-600 mb-8 max-w-2xl">
                            A community-driven platform for OpenStreetMap to report and share temporary road closures.
                            Help navigation apps route around construction, accidents, and events in real-time.
                        </p>

                        <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start mb-12">
                            <Link
                                href="/closures"
                                className="inline-flex items-center px-6 py-3 bg-blue-600 text-white rounded-full hover:bg-blue-700 font-medium transition-colors group"
                            >
                                View Live Closures
                                <ArrowRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
                            </Link>
                            <a
                                href="https://github.com/sosm/temporary-road-closures"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center px-6 py-3 border border-gray-300 text-gray-700 rounded-full hover:bg-gray-50 font-medium transition-colors"
                            >
                                View on GitHub
                            </a>
                        </div>

                        {/* Stats */}
                        <div className="grid grid-cols-3 gap-8 text-center lg:text-left">
                            <div>
                                <div className="text-2xl font-bold text-gray-900">OpenLR</div>
                                <div className="text-sm text-gray-600">Location Standard</div>
                            </div>
                            <div>
                                <div className="text-2xl font-bold text-gray-900">Real-time</div>
                                <div className="text-sm text-gray-600">Updates</div>
                            </div>
                            <div>
                                <div className="text-2xl font-bold text-gray-900">Open Source</div>
                                <div className="text-sm text-gray-600">Community</div>
                            </div>
                        </div>
                    </div>

                    {/* Animation */}
                    <div className="relative">
                        <div className="bg-white rounded-2xl shadow-2xl p-8 relative">
                            {/* Animation Controls */}
                            <div className="flex items-center justify-between mb-6">
                                <h3 className="text-lg font-semibold text-gray-900">How it Works</h3>
                                <button
                                    onClick={() => setIsAnimating(!isAnimating)}
                                    className="text-sm text-gray-500 hover:text-gray-700"
                                >
                                    {isAnimating ? 'Pause' : 'Play'}
                                </button>
                            </div>

                            {/* Animation Steps */}
                            <div className="space-y-4">
                                {animationSteps.map((step, index) => {
                                    const Icon = step.icon;
                                    const isActive = index === currentStep;

                                    return (
                                        <div
                                            key={index}
                                            className={`
                                                flex items-center space-x-4 p-4 rounded-lg transition-all duration-500
                                                ${isActive
                                                    ? `${step.bgColor} scale-105 shadow-md`
                                                    : 'bg-gray-50 opacity-60'
                                                }
                                            `}
                                        >
                                            <div className={`
                                                flex items-center justify-center w-12 h-12 rounded-full
                                                ${isActive ? 'bg-white shadow-sm' : 'bg-gray-200'}
                                                transition-all duration-500
                                            `}>
                                                <Icon className={`
                                                    w-6 h-6 transition-all duration-500
                                                    ${isActive ? step.color : 'text-gray-400'}
                                                `} />
                                            </div>
                                            <div className="flex-1">
                                                <h4 className={`
                                                    font-semibold transition-all duration-500
                                                    ${isActive ? 'text-gray-900' : 'text-gray-500'}
                                                `}>
                                                    {step.title}
                                                </h4>
                                                <p className={`
                                                    text-sm transition-all duration-500
                                                    ${isActive ? 'text-gray-600' : 'text-gray-400'}
                                                `}>
                                                    {step.description}
                                                </p>
                                            </div>
                                            {isActive && (
                                                <div className="w-3 h-3 bg-blue-600 rounded-full animate-pulse"></div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>

                            {/* Progress Indicators */}
                            <div className="flex space-x-2 mt-6 justify-center">
                                {animationSteps.map((_, index) => (
                                    <button
                                        key={index}
                                        onClick={() => setCurrentStep(index)}
                                        className={`
                                            w-3 h-3 rounded-full transition-all duration-300
                                            ${index === currentStep
                                                ? 'bg-blue-600 scale-125'
                                                : 'bg-gray-300 hover:bg-gray-400'
                                            }
                                        `}
                                    />
                                ))}
                            </div>

                            {/* Live indicator */}
                            <div className="absolute top-4 right-4 flex items-center space-x-2">
                                <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
                                <span className="text-xs text-gray-500 font-medium">LIVE</span>
                            </div>
                        </div>

                        {/* Floating elements */}
                        <div className="absolute -top-4 -right-4 w-20 h-20 bg-blue-200 rounded-full opacity-20 animate-pulse"></div>
                        <div className="absolute -bottom-6 -left-6 w-16 h-16 bg-indigo-200 rounded-full opacity-30 animate-bounce"></div>
                    </div>
                </div>
            </div>

            {/* Background Style */}
            <style jsx>{`
                .bg-grid-slate-100 {
                    background-image: url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32' width='32' height='32' fill='none' stroke='rgb(148 163 184 / 0.05)'%3e%3cpath d='m0 .5h32m-32 32v-32'/%3e%3c/svg%3e");
                }
            `}</style>
        </section>
    );
};

export default Hero;