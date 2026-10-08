'use client';

import * as React from 'react';
import { AlertTriangle, HelpCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';

export interface ConfirmOptions {
    title: string;
    description?: React.ReactNode;
    /** Label of the action button, for example "Cancel appointment". Say what will happen, not "OK". */
    confirmLabel?: string;
    /** Label of the dismiss button, for example "Keep appointment" */
    cancelLabel?: string;
    /** Red styling for actions that cannot be undone */
    destructive?: boolean;
}

export interface PromptOptions {
    title: string;
    description?: React.ReactNode;
    label: string;
    defaultValue?: string;
    placeholder?: string;
    confirmLabel?: string;
}

type Confirm = (options: ConfirmOptions) => Promise<boolean>;
/** Resolves to the text typed, or null when dismissed */
type Prompt = (options: PromptOptions) => Promise<string | null>;

const ConfirmContext = React.createContext<Confirm | null>(null);
const PromptContext = React.createContext<Prompt | null>(null);

/**
 * Replaces the browser's blocking `confirm()` with an in-app dialog.
 *
 *   const confirm = useConfirm();
 *   if (!(await confirm({ title: 'Cancel this appointment?', destructive: true }))) return;
 */
export function useConfirm(): Confirm {
    const ctx = React.useContext(ConfirmContext);
    if (!ctx) throw new Error('useConfirm must be used inside <ConfirmProvider>');
    return ctx;
}

/**
 * Replaces the browser's blocking `prompt()` with an in-app dialog containing one labelled text field.
 *
 *   const ask = usePrompt();
 *   const dose = await ask({ title: 'Custom dose', label: 'Dose', defaultValue: '1' });
 */
export function usePrompt(): Prompt {
    const ctx = React.useContext(PromptContext);
    if (!ctx) throw new Error('usePrompt must be used inside <ConfirmProvider>');
    return ctx;
}

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
    const [options, setOptions] = React.useState<ConfirmOptions | null>(null);
    const resolver = React.useRef<((value: boolean) => void) | null>(null);

    const confirm = React.useCallback<Confirm>((opts) => {
        // A second request while one is open dismisses the first (answer: no)
        resolver.current?.(false);
        setOptions(opts);
        return new Promise<boolean>((resolve) => { resolver.current = resolve; });
    }, []);

    const settle = React.useCallback((value: boolean) => {
        resolver.current?.(value);
        resolver.current = null;
        setOptions(null);
    }, []);

    const [promptOptions, setPromptOptions] = React.useState<PromptOptions | null>(null);
    const [promptValue, setPromptValue] = React.useState('');
    const promptResolver = React.useRef<((value: string | null) => void) | null>(null);

    const ask = React.useCallback<Prompt>((opts) => {
        promptResolver.current?.(null);
        setPromptValue(opts.defaultValue ?? '');
        setPromptOptions(opts);
        return new Promise<string | null>((resolve) => { promptResolver.current = resolve; });
    }, []);

    const settlePrompt = React.useCallback((value: string | null) => {
        promptResolver.current?.(value);
        promptResolver.current = null;
        setPromptOptions(null);
    }, []);

    const destructive = options?.destructive ?? false;

    return (
        <ConfirmContext.Provider value={confirm}>
          <PromptContext.Provider value={ask}>
            {children}
            <Dialog open={options !== null} onOpenChange={(open) => { if (!open) settle(false); }}>
                <DialogContent showCloseButton={false} className="sm:max-w-md">
                    <DialogHeader>
                        <div className="flex items-start gap-4">
                            <span
                                className={`mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${destructive ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-700'}`}
                                aria-hidden
                            >
                                {destructive ? <AlertTriangle className="h-5 w-5" /> : <HelpCircle className="h-5 w-5" />}
                            </span>
                            <div className="space-y-1.5 text-left">
                                <DialogTitle className="text-lg">{options?.title}</DialogTitle>
                                {options?.description && (
                                    <DialogDescription className="text-sm leading-relaxed">{options.description}</DialogDescription>
                                )}
                            </div>
                        </div>
                    </DialogHeader>
                    <DialogFooter className="gap-2 sm:gap-2">
                        <Button variant="outline" onClick={() => settle(false)} autoFocus={destructive} className="pointer-coarse:min-h-11">
                            {options?.cancelLabel ?? 'Go back'}
                        </Button>
                        <Button
                            variant={destructive ? 'destructive' : 'default'}
                            onClick={() => settle(true)}
                            autoFocus={!destructive}
                            className="pointer-coarse:min-h-11"
                        >
                            {options?.confirmLabel ?? 'Confirm'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={promptOptions !== null} onOpenChange={(open) => { if (!open) settlePrompt(null); }}>
                <DialogContent showCloseButton={false} className="sm:max-w-md">
                    <form
                        onSubmit={(e) => { e.preventDefault(); const v = promptValue.trim(); settlePrompt(v || null); }}
                        className="space-y-4"
                    >
                        <DialogHeader>
                            <DialogTitle className="text-lg">{promptOptions?.title}</DialogTitle>
                            {promptOptions?.description && <DialogDescription>{promptOptions.description}</DialogDescription>}
                        </DialogHeader>
                        <div className="space-y-1.5">
                            <Label htmlFor="prompt-input">{promptOptions?.label}</Label>
                            <Input
                                id="prompt-input" autoFocus value={promptValue} placeholder={promptOptions?.placeholder}
                                onChange={(e) => setPromptValue(e.target.value)}
                            />
                        </div>
                        <DialogFooter className="gap-2 sm:gap-2">
                            <Button type="button" variant="outline" onClick={() => settlePrompt(null)} className="pointer-coarse:min-h-11">Cancel</Button>
                            <Button type="submit" disabled={!promptValue.trim()} className="pointer-coarse:min-h-11">
                                {promptOptions?.confirmLabel ?? 'Save'}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
          </PromptContext.Provider>
        </ConfirmContext.Provider>
    );
}
