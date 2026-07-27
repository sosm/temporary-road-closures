"use client"
import React from 'react';
import { Calendar, Clock, MapPin, User, AlertCircle, Zap, Building2, Navigation, Edit3, Trash2, Target, Route as RouteIcon, TriangleAlert, Search } from 'lucide-react';
import { format, isAfter, isBefore, formatDistanceToNow } from 'date-fns';
import { useClosures } from '@/context/ClosuresContext';
import { Closure } from '@/services/api';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Sheet, SheetContent, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { useIsMobile } from '@/hooks/use-mobile';
import { MobileResponsiveStack } from '@/components/Layout/MobileResponsiveStack';
import { cn } from '@/utils/utils';

interface ClosuresListPanelProps {
    isOpen: boolean;
    onClose: () => void;
    onEditClosure?: (closureId: number) => void;
}

const ClosuresListPanel: React.FC<ClosuresListPanelProps> = ({ isOpen, onClose, onEditClosure }) => {
    const { state, selectClosure, startEditingClosure, canEditClosure, deleteClosure } = useClosures();
    const { closures, selectedClosure, loading, isAuthenticated, user, bboxTooLarge } = state;
    const isMobile = useIsMobile();

    const getClosureStatus = (closure: Closure): 'active' | 'upcoming' | 'expired' => {
        const now = new Date();
        const startTime = new Date(closure.start_time);
        const endTime = new Date(closure.end_time);

        if (isBefore(now, startTime)) return 'upcoming';
        if (isAfter(now, endTime)) return 'expired';
        return 'active';
    };

    const getConfidenceColor = (level: number) => {
        if (level >= 8) return 'text-green-600';
        if (level >= 6) return 'text-blue-600';
        if (level >= 4) return 'text-yellow-600';
        return 'text-red-600';
    };

    const formatDuration = (hours: number) => {
        if (hours < 1) return `${Math.round(hours * 60)}m`;
        if (hours < 24) return `${Math.round(hours)}h`;
        return `${Math.round(hours / 24)}d`;
    };

    const getGeometryIcon = (closure: Closure) => {
        if (closure.geometry.type === 'Point') {
            return Target;
        }
        return RouteIcon;
    };

    const getGeometryLabel = (closure: Closure) => {
        if (closure.geometry.type === 'Point') {
            return 'Point closure';
        }
        if (closure.is_bidirectional) return 'Bidirectional';
        return 'Unidirectional';
    };

    const getDirectionIcon = (closure: Closure) => {
        if (closure.geometry.type === 'Point') return '📍';
        if (closure.is_bidirectional) return '↔️';
        return '→';
    };

    const handleClosureClick = (closure: Closure) => {
        selectClosure(closure);
        if (isMobile) {
            onClose();
        }
    };

    const handleEditClick = async (e: React.MouseEvent, closureId: number) => {
        e.stopPropagation();

        try {
            await startEditingClosure(closureId);
            if (onEditClosure) {
                onEditClosure(closureId);
            }
        } catch (error) {
            console.error('Failed to start editing closure:', error);
        }
    };

    const handleDeleteClick = async (e: React.MouseEvent, closureId: number, description: string) => {
        e.stopPropagation();

        const confirmed = window.confirm(
            `Are you sure you want to delete this closure?\n\n"${description}"\n\nThis action cannot be undone.`
        );

        if (confirmed) {
            try {
                await deleteClosure(closureId);
            } catch (error) {
                console.error('Failed to delete closure:', error);
            }
        }
    };

    const activeClosures = closures.filter(c => getClosureStatus(c) === 'active').length;
    const upcomingClosures = closures.filter(c => getClosureStatus(c) === 'upcoming').length;
    const expiredClosures = closures.filter(c => getClosureStatus(c) === 'expired').length;

    // Calculate geometry statistics
    const pointClosures = closures.filter(c => c.geometry.type === 'Point').length;
    const lineStringClosures = closures.filter(c => c.geometry.type === 'LineString');
    const bidirectionalClosures = lineStringClosures.filter(c => c.is_bidirectional === true).length;
    const unidirectionalClosures = lineStringClosures.filter(c => c.is_bidirectional === false).length;

    // Shared header content
    const renderHeader = () => (
        <div className={cn("shrink-0", isMobile ? "px-5 py-3 space-y-3" : "p-4 space-y-4")}>
            <div className="flex items-center justify-between">
                <div className="space-y-1">
                    <h2 className={cn("font-bold tracking-tight text-foreground", isMobile ? "text-lg" : "text-xl")}>
                        Road Closures
                    </h2>
                    <div className="flex items-center gap-2">
                        <Badge variant="outline" className="font-mono text-[10px] py-0 rounded-full px-2">
                            {closures.length} TOTAL
                        </Badge>
                        {!isMobile && (
                            <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-tighter">
                                Real-time reporting
                            </span>
                        )}
                    </div>
                </div>

                {isAuthenticated && isMobile && (
                    <Button
                        onClick={() => {
                            window.dispatchEvent(new CustomEvent('toggle-closure-form'));
                            if (isMobile) onClose();
                        }}
                        className="h-10 px-4 bg-destructive hover:bg-destructive/90 text-white shadow-none rounded-full shrink-0 flex items-center gap-2"
                    >
                        <TriangleAlert className="w-4 h-4" />
                        <span className="text-xs font-bold uppercase tracking-tighter">Report Closure</span>
                    </Button>
                )}
            </div>

            {isAuthenticated && !isMobile && (
                <Button
                    onClick={() => {
                        window.dispatchEvent(new CustomEvent('toggle-closure-form'));
                    }}
                    className="w-full bg-destructive hover:bg-destructive/90 text-white font-bold uppercase tracking-tighter h-11 transition-all shadow-none rounded-full gap-2"
                >
                    <TriangleAlert className="w-4 h-4" />
                    <span>Report Closure</span>
                </Button>
            )}

            {/* Status Summary Grid - Restored Information */}
            <div className="grid grid-cols-3 gap-2">
                <div className="flex flex-col items-center justify-center p-2 rounded-md bg-destructive/10 border border-destructive/20 transition-all hover:bg-destructive/20">
                    <span className="text-base font-bold text-destructive leading-none">{activeClosures}</span>
                    <span className="text-[9px] font-bold uppercase text-destructive/70 mt-1 tracking-tighter">Active</span>
                </div>
                <div className="flex flex-col items-center justify-center p-2 rounded-md bg-amber-500/10 border border-amber-500/20 transition-all hover:bg-amber-500/20">
                    <span className="text-base font-bold text-amber-600 leading-none">{upcomingClosures}</span>
                    <span className="text-[9px] font-bold uppercase text-amber-600/70 mt-1 tracking-tighter">Soon</span>
                </div>
                <div className="flex flex-col items-center justify-center p-2 rounded-md bg-muted border border-border transition-all hover:bg-muted/80">
                    <span className="text-base font-bold text-muted-foreground leading-none">{expiredClosures}</span>
                    <span className="text-[9px] font-bold uppercase text-muted-foreground mt-1 tracking-tighter">Old</span>
                </div>
            </div>
            
            {/* Geometry Statistics Grid - Restored Information */}
            <div className="grid grid-cols-2 gap-2">
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-orange-50/50 border border-orange-100 transition-all">
                    <div className="w-1.5 h-1.5 rounded-full bg-orange-500 shadow-sm animate-pulse" />
                    <span className="text-[10px] font-bold text-orange-700 uppercase tracking-tighter">
                        {pointClosures} Point{pointClosures !== 1 ? 's' : ''}
                    </span>
                </div>
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/5 border border-primary/10 transition-all">
                    <div className="w-1.5 h-1.5 rounded-full bg-primary shadow-sm animate-pulse" />
                    <span className="text-[10px] font-bold text-primary uppercase tracking-tighter">
                        {lineStringClosures.length} Segment{lineStringClosures.length !== 1 ? 's' : ''}
                    </span>
                </div>
            </div>
        </div>
    );

    // Shared closures list content
    const renderClosuresList = () => (
        <div className={cn("flex-1 min-h-0 overflow-x-hidden scrollbar-thin", !isMobile && "overflow-y-auto")}>
            <div className="px-4 py-2">
                {loading ? (
                    <div className="space-y-3 py-4">
                        {[1, 2, 3, 4].map(i => (
                            <div key={i} className="space-y-2">
                                <Skeleton className="h-4 w-3/4" />
                                <Skeleton className="h-20 w-full" />
                            </div>
                        ))}
                    </div>
                ) : closures.length === 0 ? (
                    bboxTooLarge ? (
                        <div className="flex flex-col items-center justify-center py-12 text-center space-y-4">
                            <div className="p-4 bg-muted rounded-full">
                                <Search className="w-8 h-8 text-muted-foreground" />
                            </div>
                            <div className="space-y-1">
                                <p className="font-bold text-muted-foreground">Zoom in to explore</p>
                                <p className="text-xs text-muted-foreground/60 max-w-[180px]">
                                    Zoom in to see closures in this area.
                                </p>
                            </div>
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center py-12 text-center space-y-4">
                            <div className="p-4 bg-muted rounded-full">
                                <AlertCircle className="w-8 h-8 text-muted-foreground" />
                            </div>
                            <div className="space-y-1">
                                <p className="font-bold text-muted-foreground">Clear Skies</p>
                                <p className="text-xs text-muted-foreground/60 max-w-[180px]">
                                    No road closures reported in this area.
                                </p>
                            </div>
                        </div>
                    )
                ) : (
                    <div className="space-y-1.5 pb-8">
                        {closures.map((closure, index) => {
                            const status = getClosureStatus(closure);
                            const isSelected = selectedClosure?.id === closure.id;
                            const directionIcon = getDirectionIcon(closure);
                            const geometryLabel = getGeometryLabel(closure);
                            const canEdit = canEditClosure(closure);
                            const GeometryIcon = getGeometryIcon(closure);
                            const isLast = index === closures.length - 1;

                            return (
                                <React.Fragment key={closure.id}>
                                    <Card
                                        onClick={() => handleClosureClick(closure)}
                                        className={`
                                            cursor-pointer transition-all duration-200 group overflow-hidden rounded-lg outline-none ring-0 py-0 shadow-none border-2
                                            ${isSelected
                                                ? 'border-blue-600 bg-transparent'
                                                : 'border-border/50 hover:border-muted-foreground/30'
                                            }
                                        `}
                                    >
                                        <CardContent className="p-4">
                                            {/* Header with Status and Actions */}
                                            <div className="flex items-start justify-between mb-3">
                                                <Badge 
                                                    variant={status === 'active' ? 'destructive' : status === 'upcoming' ? 'secondary' : 'outline'}
                                                    className={`uppercase tracking-tighter text-[10px] font-bold ${status === 'upcoming' ? 'bg-amber-500 text-white hover:bg-amber-600 border-none' : ''}`}
                                                >
                                                    {status}
                                                </Badge>
                                                
                                                <div className="flex items-center gap-2">
                                                    {isAuthenticated && canEdit && (
                                                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                onClick={(e) => handleEditClick(e, closure.id)}
                                                                className="h-6 w-6 hover:bg-primary/10 hover:text-primary"
                                                            >
                                                                <Edit3 className="h-3 w-3" />
                                                            </Button>
                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                onClick={(e) => handleDeleteClick(e, closure.id, closure.description)}
                                                                className="h-6 w-6 hover:bg-destructive/10 hover:text-destructive"
                                                            >
                                                                <Trash2 className="h-3 w-3" />
                                                            </Button>
                                                        </div>
                                                    )}
                                                    <div className="flex items-center space-x-1">
                                                        <Zap className="w-3 h-3 text-muted-foreground" />
                                                        <span className={`text-xs font-medium ${getConfidenceColor(closure.confidence_level)}`}>
                                                            {closure.confidence_level}/10
                                                        </span>
                                                    </div>
                                                    <span className="text-xs text-muted-foreground font-medium">
                                                        {formatDuration(closure.duration_hours)}
                                                    </span>
                                                    <div className="flex items-center gap-1.5 ml-1 pl-1.5 border-l border-border/50">
                                                        <Clock className="w-3 h-3 text-muted-foreground/60" />
                                                        <span className="text-[10px] text-muted-foreground/60 uppercase font-bold tracking-tighter">
                                                            {formatDistanceToNow(new Date(closure.updated_at))} ago
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Description */}
                                            <h3 className="text-sm font-bold text-foreground leading-tight mb-1 line-clamp-2">
                                                {closure.description}
                                            </h3>
                                            <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground/70 mb-3 ml-0.5">
                                                <div className="w-1 h-1 rounded-full bg-muted-foreground/30" />
                                                <span className="font-medium tracking-tight">Source: {closure.source}</span>
                                            </div>

                                            {/* Meta Info Grid */}
                                            <div className="grid grid-cols-2 gap-y-2 text-[10px] items-center">
                                                <div className="flex items-center gap-1.5 text-muted-foreground font-bold uppercase tracking-tighter">
                                                    <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse"></div>
                                                    <span>{closure.closure_type.replace('_', ' ')}</span>
                                                </div>
                                                <div className="flex items-center gap-1.5 justify-end text-muted-foreground">
                                                    <GeometryIcon className={`w-3 h-3 ${closure.geometry.type === 'Point' ? 'text-orange-600' : 'text-primary'}`} />
                                                    <span className="text-sm" title={geometryLabel}>{directionIcon}</span>
                                                    <span className="text-xs">
                                                        {closure.geometry.type === 'Point' ? 'Point' :
                                                            closure.is_bidirectional ? 'Both ways' : 'One way'}
                                                    </span>
                                                </div>
                                            </div>

                                            {/* Timing & Details */}
                                            <div className="mt-3 pt-3 border-t border-border/50 space-y-1 text-xs text-muted-foreground">
                                                <div className="flex items-center space-x-1">
                                                    <Calendar className="w-3 h-3" />
                                                    <span>
                                                        {format(new Date(closure.start_time), 'MMM dd, HH:mm')} -
                                                        {format(new Date(closure.end_time), 'MMM dd, HH:mm')}
                                                    </span>
                                                </div>

                                                <div className="flex items-center space-x-1">
                                                    <Building2 className="w-3 h-3" />
                                                    <span>Source: {closure.source}</span>
                                                </div>

                                                {closure.openlr_code && (
                                                    <div className="flex items-center space-x-1">
                                                        <MapPin className="w-3 h-3" />
                                                        <span className="font-mono text-xs">
                                                            OpenLR: {closure.openlr_code.substring(0, 8)}...
                                                        </span>
                                                    </div>
                                                )}

                                                {/* Geometry information */}
                                                <div className="flex items-center space-x-1">
                                                    <GeometryIcon className="w-3 h-3" />
                                                    <span className="text-xs">
                                                        {closure.geometry.type === 'Point' ? 'Point closure' :
                                                            closure.is_bidirectional
                                                                ? 'Bidirectional road segment'
                                                                : 'Unidirectional road segment'}
                                                    </span>
                                                </div>

                                                {/* Submitter info */}
                                                <div className="flex items-center space-x-1">
                                                    <User className="w-3 h-3" />
                                                    <span className="text-xs">ID: #{closure.id}</span>
                                                    {canEdit && (
                                                        <span className="text-green-600 font-medium ml-1">(Your closure)</span>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Validation Status */}
                                            {!closure.is_valid && (
                                                <div className="mt-2 flex items-center space-x-1">
                                                    <AlertCircle className="w-3 h-3 text-yellow-500" />
                                                    <span className="text-xs text-yellow-600 font-medium">Validation pending</span>
                                                </div>
                                            )}
                                        </CardContent>
                                    </Card>
                                    {!isLast && (
                                        <div className="py-0">
                                            <Separator className="opacity-10" />
                                        </div>
                                    )}
                                </React.Fragment>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );

    const renderFooter = () => (
        <div className={cn(
            "border-t border-border bg-muted/20 shrink-0 flex flex-col p-4 gap-3",
            isMobile ? "pb-8" : "pb-4"
        )}>
            <div className="bg-background/80 border border-border/50 rounded-xl p-3 space-y-2.5 shadow-sm">
                <div className="flex items-center justify-between border-b border-border/30 pb-2">
                    <div className="flex items-center gap-2">
                        <Target className="w-4 h-4 text-orange-600" />
                        <span className="text-[10px] font-black uppercase tracking-widest text-foreground/60">Geometry Types</span>
                    </div>
                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-1.5">
                            <Target className="w-3.5 h-3.5 text-orange-500/70" />
                            <span className="text-xs font-bold font-mono">{pointClosures}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                            <Navigation className="w-3.5 h-3.5 text-primary/70" />
                            <span className="text-xs font-bold font-mono">{lineStringClosures.length}</span>
                        </div>
                    </div>
                </div>

                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Navigation className="w-4 h-4 text-primary" />
                        <span className="text-[10px] font-black uppercase tracking-widest text-foreground/60">Direction Info</span>
                    </div>
                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-1.5">
                            <span className="text-sm text-muted-foreground/60 opacity-70">↔</span>
                            <span className="text-xs font-bold font-mono">{bidirectionalClosures}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                            <span className="text-sm text-muted-foreground/60 opacity-70">→</span>
                            <span className="text-xs font-bold font-mono">{unidirectionalClosures}</span>
                        </div>
                    </div>
                </div>
            </div>

            {!isAuthenticated && (
                <div className="bg-orange-500/10 border border-orange-500/20 rounded-xl p-3 flex items-center gap-3 animate-in fade-in slide-in-from-bottom-2 duration-500">
                    <div className="h-8 w-8 rounded-full bg-orange-500/20 flex items-center justify-center shrink-0">
                        <AlertCircle className="w-4 h-4 text-orange-600" />
                    </div>
                    <div>
                        <p className="text-[10px] font-black uppercase tracking-widest text-orange-700 leading-none">Demo Mode Active</p>
                        <p className="text-[8px] text-orange-600/70 uppercase font-bold tracking-tight mt-1">Updates are temporary</p>
                    </div>
                </div>
            )}

            {isAuthenticated && !isMobile && (
                <div className="text-[9px] text-muted-foreground/50 text-center uppercase tracking-widest font-black py-1">
                    API Connected & Ready
                </div>
            )}
        </div>
    );

    // --- MOBILE: Peekable Bottom Sheet ---
    if (isMobile) {
        return (
            <MobileResponsiveStack
                isOpen={isOpen}
                onClose={onClose}
                header={renderHeader()}
                footer={renderFooter()}
                peekHeight="h-[310px]"
                midHeight="h-[40vh]"
                fullHeight="h-[80vh]"
            >
                <div className="px-4 py-2 flex items-center justify-between border-t border-slate-50 mt-2">
                    <span className="text-xs font-black uppercase tracking-widest text-slate-400">Closure Details</span>
                    <div className="h-[1px] flex-1 bg-slate-50 ml-4"></div>
                </div>
                {renderClosuresList()}
            </MobileResponsiveStack>
        );
    }

    // --- DESKTOP: Sidebar ---
    return (
        <div className={`
            fixed top-16 left-0 h-[calc(100vh-4rem)] w-80 bg-background shadow-2xl transform transition-transform duration-300 ease-in-out z-50
            ${isOpen ? 'translate-x-0' : '-translate-x-full'}
            md:relative md:top-0 md:h-full md:translate-x-0 md:shadow-none md:border-r md:border-border flex flex-col overflow-hidden
        `}>
            {renderHeader()}
            <Separator className="opacity-50" />
            {renderClosuresList()}
            {renderFooter()}
        </div>
    );
};

export default ClosuresListPanel;