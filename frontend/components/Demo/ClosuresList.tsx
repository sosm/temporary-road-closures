import React from 'react';
import { AlertTriangle, Clock, MapPin, Navigation, Building2, Zap, Car, Bike, User, CheckCircle, XCircle } from 'lucide-react';
import { format } from 'date-fns';

import { Closure } from '@/services/api';
import { TransportationMode, doesClosureAffectMode, closureTypeEffects } from '@/utils/routing-utils';

interface ClosuresListProps {
    closures: Closure[];
    transportationMode: TransportationMode;
}

const transportationIcons = {
    auto: Car,
    bicycle: Bike,
    pedestrian: User,
} as const;

const ClosuresList: React.FC<ClosuresListProps> = ({ closures, transportationMode }) => {
    const [showExpired, setShowExpired] = React.useState(false);

    const getClosureTypeIcon = (type: string) => {
        switch (type) {
            case 'construction':
                return '🚧';
            case 'accident':
                return '💥';
            case 'event':
                return '🎉';
            case 'maintenance':
                return '🔧';
            case 'weather':
                return '🌧️';
            case 'emergency':
                return '🚨';
            case 'sidewalk_repair':
                return '🚶';
            case 'bike_lane_closure':
                return '🚲';
            case 'bridge_closure':
                return '🌉';
            case 'tunnel_closure':
                return '🚇';
            default:
                return '⚠️';
        }
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'active':
                return 'text-red-600 bg-red-100 border-red-200';
            case 'cancelled':
                return 'text-blue-600 bg-blue-100 border-blue-200';
            case 'expired':
                return 'text-gray-600 bg-gray-100 border-gray-200';
            case 'planned':
                return 'text-yellow-600 bg-yellow-100 border-yellow-200';
            default:
                return 'text-gray-600 bg-gray-100 border-gray-200';
        }
    };

    const getConfidenceColor = (level: number) => {
        if (level >= 8) return 'text-green-600';
        if (level >= 6) return 'text-blue-600';
        if (level >= 4) return 'text-yellow-600';
        return 'text-red-600';
    };

    const getDirectionInfo = (closure: Closure) => {
        if (closure.geometry.type === 'Point') {
            return { icon: '📍', label: 'Point closure' };
        }

        if (closure.is_bidirectional) {
            return { icon: '↔️', label: 'Both directions' };
        }

        return { icon: '→', label: 'One direction' };
    };

    const formatDuration = (start: string, end: string) => {
        const startDate = new Date(start);
        const endDate = new Date(end);
        const duration = (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60);

        if (duration < 1) return `${Math.round(duration * 60)}m`;
        if (duration < 24) return `${Math.round(duration)}h`;
        return `${Math.round(duration / 24)}d`;
    };

    const isClosureActive = (closure: Closure) => {
        const now = new Date();
        const start = new Date(closure.start_time);
        const end = new Date(closure.end_time);
        return now >= start && now <= end;
    };

    const TransportationIcon = transportationIcons[transportationMode] ?? Navigation;

    const activeClosures = closures.filter(isClosureActive);
    const upcomingClosures = closures.filter(c => new Date(c.start_time) > new Date());
    const expiredClosures = closures.filter(c => new Date(c.end_time) < new Date());
    const displayedClosures = [...closures]
        .filter(closure =>
            showExpired || new Date(closure.end_time) >= new Date()
        )
        .sort((a, b) => {
            const relevanceDifference =
                Number(doesClosureAffectMode(b, transportationMode)) -
                Number(doesClosureAffectMode(a, transportationMode));

            if (relevanceDifference !== 0) return relevanceDifference;

            const activeDifference =
                Number(isClosureActive(b)) - Number(isClosureActive(a));

            if (activeDifference !== 0) return activeDifference;

            const startDifference =
                new Date(b.start_time).getTime() -
                new Date(a.start_time).getTime();

            return startDifference !== 0
                ? startDifference
                : b.id - a.id;
        });

    // Count relevant vs irrelevant closures
    const relevantActiveClosures = activeClosures.filter(c => doesClosureAffectMode(c, transportationMode));
    const irrelevantActiveClosures = activeClosures.filter(c => !doesClosureAffectMode(c, transportationMode));

    if (closures.length === 0) {
        return null;
    }

    return (
        <div className="border-t border-gray-200 bg-white">
            <div className="p-4">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-xl font-bold text-slate-900 tracking-tight">
                        Road Closures <span className="text-slate-400">({closures.length})</span>
                    </h3>
                </div>
                <p className="text-sm font-medium text-slate-500 mb-6 leading-none">Click on a closure to view on map</p>

                {/* Transportation Mode Header */}
                <div className="flex items-center space-x-2 mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                    <TransportationIcon className="w-4 h-4 text-blue-600" />
                    <div className="flex-1">
                        <div className="text-sm font-medium text-blue-900 capitalize">
                            {transportationMode} Mode Analysis
                        </div>
                        <div className="text-xs text-blue-700">
                            Showing which closures affect your selected transportation mode
                        </div>
                    </div>
                </div>

                {/* Summary Stats */}
                <div className="grid grid-cols-2 gap-2 mb-4">
                    <div className="text-center p-3 bg-red-50 rounded-lg">
                        <div className="text-lg font-bold text-red-800">
                            {relevantActiveClosures.length}
                        </div>
                        <div className="text-xs text-red-600">Affecting Route</div>
                        <div className="text-xs text-red-500 mt-1">
                            {relevantActiveClosures.length > 0 ? '🚫 Avoided in routing' : '✅ No restrictions'}
                        </div>
                    </div>
                    <div className="text-center p-3 bg-green-50 rounded-lg">
                        <div className="text-lg font-bold text-green-800">
                            {irrelevantActiveClosures.length}
                        </div>
                        <div className="text-xs text-green-600">Not Affecting</div>
                        <div className="text-xs text-green-500 mt-1">
                            ✅ Safe to ignore
                        </div>
                    </div>
                </div>

                {/* Secondary Stats */}
                <div className="grid grid-cols-3 gap-2 mt-4 mb-6">
                    <div className="text-center p-2 bg-red-50/50 rounded-xl border border-red-100/50">
                        <div className="text-sm font-bold text-red-700 leading-tight">
                            {activeClosures.length}
                        </div>
                        <div className="text-[8px] font-bold text-red-600 uppercase tracking-tight">Active</div>
                    </div>
                    <div className="text-center p-2 bg-amber-50/50 rounded-xl border border-amber-100/50">
                        <div className="text-sm font-bold text-amber-700 leading-tight">
                            {upcomingClosures.length}
                        </div>
                        <div className="text-[8px] font-bold text-amber-600 uppercase tracking-tight">Upcoming</div>
                    </div>
                    <div className="text-center p-2 bg-slate-50/50 rounded-xl border border-slate-100/50">
                        <div className="text-sm font-bold text-slate-700 leading-tight">
                            {expiredClosures.length}
                        </div>
                        <div className="text-[8px] font-bold text-slate-600 uppercase tracking-tight">Expired</div>
                    </div>
                </div>

                {/* Closures List */}
		<label className="mb-3 flex cursor-pointer items-center gap-2 text-sm text-slate-600">
                    <input
                        type="checkbox"
                        checked={showExpired}
                        onChange={event => setShowExpired(event.target.checked)}
                        className="h-4 w-4 rounded border-slate-300 accent-red-600"
                    />
                    <span>Show expired closures</span>
                    {expiredClosures.length > 0 && (
                        <span className="ml-auto rounded-full bg-slate-100 px-2 py-0.5 text-xs font-bold">
                            {expiredClosures.length}
                        </span>
                    )}
                </label>

                <div className="space-y-3">
		   {displayedClosures.length === 0 ? (
                        <p className="py-4 text-center text-sm text-slate-500">
                            No active or upcoming closures.
                        </p>
                    ) : displayedClosures
                        .map((closure) => {
                            const active = isClosureActive(closure);
                            const direction = getDirectionInfo(closure);
                            const affectsMode = doesClosureAffectMode(closure, transportationMode);
                            const affectedModes = closureTypeEffects[closure.closure_type] || ['auto', 'bicycle', 'pedestrian'];

                            return (
                                <div
                                    key={closure.id}
                                    className={`border rounded-lg p-3 transition-colors ${active && affectsMode
                                        ? 'border-red-200 bg-red-50'
                                        : active && !affectsMode
                                            ? 'border-green-200 bg-green-50'
                                            : 'border-gray-200 bg-gray-50'
                                        }`}
                                >
                                    {/* Header */}
                                    <div className="flex items-start justify-between mb-2">
                                        <div className="flex items-center space-x-2">
                                            <span className="text-lg">{getClosureTypeIcon(closure.closure_type)}</span>
                                            <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium border ${getStatusColor(closure.status)}`}>
                                                {closure.status}
                                            </span>
                                            {active && (
                                                affectsMode ? (
                                                    <div className="inline-flex items-center space-x-1 px-2 py-1 bg-red-100 text-red-700 rounded-full text-xs">
                                                        <XCircle className="w-3 h-3" />
                                                        <span>Blocks Route</span>
                                                    </div>
                                                ) : (
                                                    <div className="inline-flex items-center space-x-1 px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs">
                                                        <CheckCircle className="w-3 h-3" />
                                                        <span>Doesn't Affect</span>
                                                    </div>
                                                )
                                            )}
                                        </div>
                                        <div className="flex items-center space-x-1">
                                            <Zap className="w-3 h-3 text-gray-400" />
                                            <span className={`text-xs font-medium ${getConfidenceColor(closure.confidence_level)}`}>
                                                {closure.confidence_level}/10
                                            </span>
                                        </div>
                                    </div>

                                    {/* Description */}
                                    <h4 className="font-medium text-gray-900 mb-2 text-sm line-clamp-2">
                                        {closure.description}
                                    </h4>

                                    {/* Transportation Mode Effects */}
                                    <div className="flex items-center space-x-3 mb-2 text-xs">
                                        <span className="text-gray-600">Affects:</span>
                                        <div className="flex items-center space-x-2">
                                            {['auto', 'bicycle', 'pedestrian'].map((mode) => {
                                                const Icon = transportationIcons[mode as TransportationMode] ?? Navigation;
                                                const isAffected = affectedModes.includes(mode as TransportationMode);
                                                const isCurrentMode = mode === transportationMode;

                                                return (
                                                    <div
                                                        key={mode}
                                                        className={`inline-flex items-center space-x-1 px-2 py-1 rounded-full ${isAffected
                                                            ? isCurrentMode
                                                                ? 'bg-red-100 text-red-700 border border-red-200'
                                                                : 'bg-orange-100 text-orange-600'
                                                            : isCurrentMode
                                                                ? 'bg-green-100 text-green-700 border border-green-200'
                                                                : 'bg-gray-100 text-gray-400'
                                                            }`}
                                                        title={`${isAffected ? 'Affects' : 'Does not affect'} ${mode}`}
                                                    >
                                                        <Icon className="w-3 h-3" />
                                                        {isCurrentMode && (
                                                            <span className="text-xs">
                                                                {isAffected ? '✗' : '✓'}
                                                            </span>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>

                                    {/* Details */}
                                    <div className="space-y-1 text-xs text-gray-600">
                                        {/* Type and Direction */}
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center space-x-1">
                                                <span className="capitalize">{closure.closure_type.replace('_', ' ')}</span>
                                            </div>
                                            <div className="flex items-center space-x-1">
                                                <span>{direction.icon}</span>
                                                <span>{direction.label}</span>
                                            </div>
                                        </div>

                                        {/* Timing */}
                                        <div className="flex items-center space-x-1">
                                            <Clock className="w-3 h-3" />
                                            <span>
                                                {format(new Date(closure.start_time), 'MMM dd, HH:mm')} -
                                                {format(new Date(closure.end_time), 'MMM dd, HH:mm')}
                                            </span>
                                            <span className="text-gray-500">
                                                ({formatDuration(closure.start_time, closure.end_time)})
                                            </span>
                                        </div>

                                        {/* Source */}
                                        <div className="flex items-center space-x-1">
                                            <Building2 className="w-3 h-3" />
                                            <span>{closure.source}</span>
                                        </div>

                                        {/* Geometry info */}
                                        <div className="flex items-center space-x-1">
                                            <MapPin className="w-3 h-3" />
                                            <span>
                                                {closure.geometry.type === 'Point'
                                                    ? 'Point location'
                                                    : `${closure.geometry.coordinates.length} coordinate points`
                                                }
                                            </span>
                                        </div>
                                    </div>

                                    {/* Active indicator for relevant closures */}
                                    {active && affectsMode && (
                                        <div className="mt-2 pt-2 border-t border-red-200">
                                            <div className="flex items-center space-x-2">
                                                <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
                                                <span className="text-xs font-medium text-red-700">
                                                    Currently blocking {transportationMode} traffic - avoided in route
                                                </span>
                                            </div>
                                        </div>
                                    )}

                                    {/* Active indicator for irrelevant closures */}
                                    {active && !affectsMode && (
                                        <div className="mt-2 pt-2 border-t border-green-200">
                                            <div className="flex items-center space-x-2">
                                                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                                                <span className="text-xs font-medium text-green-700">
                                                    Active but doesn't affect {transportationMode} traffic
                                                </span>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                </div>

            </div>
        </div>
    );
};

export default ClosuresList;
