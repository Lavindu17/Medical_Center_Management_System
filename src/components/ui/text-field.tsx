'use client';

import * as React from 'react';
import { AlertCircle, CheckCircle2, Eye, EyeOff, Info } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

interface TextFieldProps extends Omit<React.ComponentProps<'input'>, 'id'> {
    label: string;
    /** Helper text under the field */
    hint?: React.ReactNode;
    /** Error text; also marks the field invalid for assistive technology */
    error?: string | null;
    /** Right-aligned content on the label row, e.g. a "Forgot password?" link */
    labelAction?: React.ReactNode;
    /** Content shown inside the right edge of the input, e.g. a show/hide button */
    trailing?: React.ReactNode;
}

/**
 * A labelled input with an optional hint and error, wired up for screen readers (label, aria-describedby,
 * aria-invalid). Errors appear directly under the field they belong to.
 */
export const TextField = React.forwardRef<HTMLInputElement, TextFieldProps>(function TextField(
    { label, hint, error, labelAction, trailing, className, required, ...props }, ref,
) {
    const id = React.useId();
    const hintId = `${id}-hint`;
    const errorId = `${id}-error`;
    const describedBy = [error ? errorId : null, hint ? hintId : null].filter(Boolean).join(' ') || undefined;

    return (
        <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-3">
                <Label htmlFor={id} className="text-sm font-medium text-neutral-800">
                    <span>
                        {label}
                        {required && <span className="ml-0.5 text-red-700" aria-hidden>*</span>}
                    </span>
                </Label>
                {labelAction}
            </div>
            <div className="relative">
                <Input
                    ref={ref}
                    id={id}
                    required={required}
                    aria-invalid={error ? true : undefined}
                    aria-describedby={describedBy}
                    className={cn('h-11 md:h-10', trailing ? 'pr-12' : '', className)}
                    {...props}
                />
                {trailing && <div className="absolute inset-y-0 right-1 flex items-center">{trailing}</div>}
            </div>
            {error ? (
                <p id={errorId} role="alert" className="flex items-start gap-1.5 text-sm text-red-700">
                    <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" aria-hidden />
                    {error}
                </p>
            ) : hint ? (
                <p id={hintId} className="text-xs text-neutral-500">{hint}</p>
            ) : null}
        </div>
    );
});

/** A password field with a show/hide toggle (people mistype passwords far more often than they are overheard). */
export const PasswordField = React.forwardRef<HTMLInputElement, Omit<TextFieldProps, 'type' | 'trailing'>>(function PasswordField(
    props, ref,
) {
    const [visible, setVisible] = React.useState(false);
    return (
        <TextField
            ref={ref}
            type={visible ? 'text' : 'password'}
            trailing={
                <button
                    type="button"
                    onClick={() => setVisible((v) => !v)}
                    aria-label={visible ? 'Hide password' : 'Show password'}
                    aria-pressed={visible}
                    className="flex h-9 w-9 items-center justify-center rounded-md text-neutral-500 hover:bg-neutral-100 hover:text-neutral-800"
                >
                    {visible ? <EyeOff className="h-4 w-4" aria-hidden /> : <Eye className="h-4 w-4" aria-hidden />}
                </button>
            }
            {...props}
        />
    );
});

const ALERT_TONES = {
    error:   { box: 'border-red-200 bg-red-50 text-red-900',       icon: AlertCircle,  role: 'alert'  as const },
    success: { box: 'border-emerald-200 bg-emerald-50 text-emerald-900', icon: CheckCircle2, role: 'status' as const },
    info:    { box: 'border-sky-200 bg-sky-50 text-sky-900',       icon: Info,         role: 'status' as const },
};

/** A message about the form as a whole (failed sign-in, "check your email"). Announced to screen readers. */
export function FormAlert({
    tone = 'error', children, className,
}: { tone?: keyof typeof ALERT_TONES; children: React.ReactNode; className?: string }) {
    const t = ALERT_TONES[tone];
    const Icon = t.icon;
    return (
        <div role={t.role} className={cn('flex items-start gap-2.5 rounded-lg border px-3.5 py-3 text-sm', t.box, className)}>
            <Icon className="mt-0.5 h-4 w-4 flex-shrink-0" aria-hidden />
            <div className="min-w-0">{children}</div>
        </div>
    );
}
