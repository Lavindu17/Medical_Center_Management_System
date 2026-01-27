
import React from 'react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, getDay, isBefore, startOfDay, addMonths, subMonths } from 'date-fns';
import { ChevronLeft, ChevronRight, Ban, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface CalendarGridProps {
    currentMonth: Date;
    onMonthChange: (date: Date) => void;
    schedules: any[]; // { days: ['Monday'], start_time, end_time }
    blockedDates: any[]; // { date: string, reason: string }
    onDateClick: (date: Date, isBlocked: boolean, isWorking: boolean) => void;
}

export function CalendarGrid({ currentMonth, onMonthChange, schedules, blockedDates, onDateClick }: CalendarGridProps) {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });

    // Calculate empty slots for start of month alignment
    const startDayOfWeek = getDay(monthStart); // 0 (Sun) - 6 (Sat)
    // Adjust for Monday start if needed, but let's stick to Sunday start for standard UI
    const emptySlots = Array(startDayOfWeek).fill(null);

    const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

    const getDayStatus = (date: Date) => {
        const isPast = isBefore(date, startOfDay(new Date()));
        const dateStr = format(date, 'yyyy-MM-dd');

        // Check if Blocked - with normalized date comparison
        const blocked = blockedDates.find(b => {
            if (!b.date) return false;
            // Extract just the date part, handling both DATE and DATETIME formats
            // This handles: "2026-01-27", "2026-01-27T00:00:00", "2026-01-27 00:00:00"
            const blockedDateStr = typeof b.date === 'string'
                ? b.date.split('T')[0].split(' ')[0]  // Handle both ISO and MySQL formats
                : format(new Date(b.date), 'yyyy-MM-dd');
            return blockedDateStr === dateStr;
        });
        if (blocked) return { status: 'blocked', reason: blocked.reason };

        // Check if Working
        const dayName = dayNames[getDay(date)];
        const isWorking = schedules.some(s => s.days && s.days.includes(dayName));

        return { status: isWorking ? 'working' : 'off', reason: '' };
    };

    return (
        <div className="border rounded-lg bg-white shadow-sm overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between p-4 bg-neutral-50 border-b">
                <h2 className="font-semibold text-lg text-neutral-800">
                    {format(currentMonth, 'MMMM yyyy')}
                </h2>
                <div className="flex gap-1">
                    <Button variant="outline" size="icon" onClick={() => onMonthChange(subMonths(currentMonth, 1))}>
                        <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Button variant="outline" size="icon" onClick={() => onMonthChange(addMonths(currentMonth, 1))}>
                        <ChevronRight className="h-4 w-4" />
                    </Button>
                </div>
            </div>

            {/* Grid */}
            <div className="grid grid-cols-7 border-b bg-neutral-100">
                {weekDays.map(d => (
                    <div key={d} className="p-2 text-center text-xs font-semibold text-neutral-500 uppercase tracking-wide">
                        {d}
                    </div>
                ))}
            </div>

            <div className="grid grid-cols-7 ">
                {emptySlots.map((_, i) => (
                    <div key={`empty-${i}`} className="h-24 bg-neutral-50/50 border-b border-r last:border-r-0" />
                ))}

                {daysInMonth.map(date => {
                    const { status, reason } = getDayStatus(date);
                    const isPast = isBefore(date, startOfDay(new Date()));
                    const isToday = isSameDay(date, new Date());

                    let bgClass = 'bg-white';
                    let textClass = 'text-neutral-700';
                    let borderClass = 'border-transparent';

                    if (status === 'blocked') {
                        bgClass = 'bg-red-50 hover:bg-red-100';
                        textClass = 'text-red-700';
                        borderClass = 'border-red-200';
                    } else if (status === 'working') {
                        bgClass = 'bg-white hover:bg-neutral-50';
                        textClass = 'text-neutral-900';
                    } else {
                        bgClass = 'bg-neutral-50 text-neutral-400';
                    }

                    if (isToday) {
                        bgClass += ' ring-2 ring-inset ring-emerald-500';
                    }

                    return (
                        <div
                            key={date.toString()}
                            onClick={() => !isPast && onDateClick(date, status === 'blocked', status === 'working')}
                            className={`
                                h-24 p-2 border-b border-r last:border-r-0 relative transition-colors cursor-pointer
                                ${bgClass}
                                ${isPast ? 'opacity-50 cursor-not-allowed bg-neutral-100' : ''}
                            `}
                        >
                            <div className="flex justify-between items-start">
                                <span className={`text-sm font-medium ${isSameMonth(date, currentMonth) ? '' : 'text-neutral-300'}`}>
                                    {format(date, 'd')}
                                </span>
                                {status === 'blocked' && <Ban className="h-4 w-4 text-red-500" />}
                                {status === 'working' && !isPast && <div className="h-2 w-2 rounded-full bg-green-500" />}
                            </div>

                            <div className="mt-2 text-xs">
                                {status === 'blocked' && (
                                    <span className="block truncate text-red-600 font-medium">
                                        {reason || 'Blocked'}
                                    </span>
                                )}
                                {status === 'working' && (
                                    <span className="block truncate text-neutral-500">
                                        Available
                                    </span>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Legend */}
            <div className="p-3 bg-neutral-50 border-t flex gap-4 text-xs text-neutral-600">
                <div className="flex items-center gap-1">
                    <div className="h-2 w-2 rounded-full bg-green-500" /> Working Day
                </div>
                <div className="flex items-center gap-1">
                    <div className="h-2 w-2 rounded-full bg-red-500" /> Blocked
                </div>
                <div className="flex items-center gap-1">
                    <div className="h-2 w-2 rounded-full bg-neutral-300" /> Off Day
                </div>
            </div>
        </div>
    );
}
