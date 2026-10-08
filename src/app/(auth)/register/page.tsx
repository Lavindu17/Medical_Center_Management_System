'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Check, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { FormAlert, PasswordField, TextField } from '@/components/ui/text-field';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AuthShell } from '@/components/auth/AuthShell';
import { cn } from '@/lib/utils';

type FieldErrors = Partial<Record<'firstName' | 'lastName' | 'email' | 'password' | 'dob' | 'gender', string>>;

const FIELD_LABELS: Record<string, string> = {
    firstName: 'First name', lastName: 'Last name', email: 'Email', password: 'Password', dob: 'Date of birth', gender: 'Gender',
};

/** A friendly three-step read of the password: it only has to clear the server's minimum, but longer is nudged. */
function passwordStrength(value: string) {
    if (!value) return { level: 0, label: '' };
    let score = 0;
    if (value.length >= 6) score++;
    if (value.length >= 10) score++;
    if (/[a-z]/.test(value) && /[A-Z]/.test(value) && /\d/.test(value)) score++;
    const level = value.length < 6 ? 1 : Math.max(1, Math.min(3, score));
    return { level, label: ['', 'Too short or weak', 'Okay', 'Strong'][value.length < 6 ? 1 : level] };
}

export default function RegisterPage() {
    const router = useRouter();
    const [isLoading, setIsLoading] = useState(false);
    const [formError, setFormError] = useState<string | null>(null);
    const [errors, setErrors] = useState<FieldErrors>({});
    const [password, setPassword] = useState('');
    const [gender, setGender] = useState('');

    const today = new Date().toLocaleDateString('en-CA');
    const strength = passwordStrength(password);

    // Validate a field when the person leaves it, not on every keystroke and not only at submit
    function validate(name: keyof FieldErrors, value: string): string | undefined {
        switch (name) {
            case 'firstName': return value.trim().length < 2 ? 'Enter your first name (at least 2 letters).' : undefined;
            case 'lastName': return value.trim().length < 1 ? 'Enter your last name.' : undefined;
            case 'email': return /^\S+@\S+\.\S+$/.test(value.trim()) ? undefined : 'Enter a valid email address, like name@example.com.';
            case 'password': return value.length < 6 ? 'Use at least 6 characters.' : undefined;
            case 'dob': return !value ? 'Enter your date of birth.' : value > today ? 'Date of birth cannot be in the future.' : undefined;
            case 'gender': return value ? undefined : 'Choose an option.';
        }
    }
    const onBlur = (name: keyof FieldErrors) => (e: React.FocusEvent<HTMLInputElement>) =>
        setErrors((prev) => ({ ...prev, [name]: validate(name, e.target.value) }));

    async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setFormError(null);

        const formData = new FormData(event.currentTarget);
        const payload = {
            firstName: String(formData.get('firstName') ?? '').trim(),
            lastName: String(formData.get('lastName') ?? '').trim(),
            email: String(formData.get('email') ?? '').trim(),
            password: String(formData.get('password') ?? ''),
            dob: String(formData.get('dob') ?? ''),
            gender,
        };

        const found: FieldErrors = {};
        (Object.keys(payload) as (keyof FieldErrors)[]).forEach((k) => {
            const message = validate(k, payload[k]);
            if (message) found[k] = message;
        });
        setErrors(found);
        if (Object.keys(found).length > 0) {
            // Take the person to the first problem instead of leaving them to hunt for it
            const first = Object.keys(found)[0];
            (event.currentTarget.elements.namedItem(first) as HTMLElement | null)?.focus();
            return;
        }

        setIsLoading(true);
        try {
            const response = await fetch('/api/auth/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });
            const data = await response.json().catch(() => ({}));

            if (!response.ok) {
                // The server's own field-level messages win over the generic one
                const fieldErrors: Record<string, string[]> | undefined = data.errors?.fieldErrors;
                if (fieldErrors && Object.keys(fieldErrors).length > 0) {
                    const mapped: FieldErrors = {};
                    for (const [key, messages] of Object.entries(fieldErrors)) {
                        mapped[key as keyof FieldErrors] = `${FIELD_LABELS[key] ?? key}: ${messages[0]}`;
                    }
                    setErrors(mapped);
                }
                throw new Error(response.status === 409 ? 'An account with this email already exists. Try signing in instead.' : (data.message || 'Registration failed.'));
            }

            toast.success(data.emailSent === false ? 'Account created. We could not send the email yet.' : 'Account created. Check your email for the code.');
            router.push(`/verify-email?email=${encodeURIComponent(payload.email)}${data.emailSent === false ? '&resend=1' : ''}`);
        } catch (err) {
            setFormError(err instanceof Error ? err.message : 'Registration failed.');
            setIsLoading(false);
        }
    }

    return (
        <AuthShell
            title="Create your account"
            subtitle="Register as a patient to book appointments and see your records."
            footer={
                <>
                    Already have an account?{' '}
                    <Link href="/login" className="font-semibold text-emerald-700 hover:underline">Sign in</Link>
                </>
            }
        >
            <form onSubmit={handleSubmit} noValidate className="space-y-5" aria-busy={isLoading}>
                {formError && <FormAlert>{formError}</FormAlert>}

                <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                    <TextField label="First name" name="firstName" autoComplete="given-name" required error={errors.firstName} onBlur={onBlur('firstName')} />
                    <TextField label="Last name" name="lastName" autoComplete="family-name" required error={errors.lastName} onBlur={onBlur('lastName')} />
                </div>

                <TextField
                    label="Email" name="email" type="email" inputMode="email" autoComplete="email"
                    placeholder="you@example.com" required error={errors.email} onBlur={onBlur('email')}
                    hint="We email you a code to confirm it is yours."
                />

                <div className="space-y-2">
                    <PasswordField
                        label="Password" name="password" autoComplete="new-password" required
                        value={password} onChange={(e) => setPassword(e.target.value)}
                        error={errors.password} onBlur={onBlur('password')}
                    />
                    {password && (
                        <div aria-live="polite" className="space-y-1.5">
                            <div className="flex gap-1.5" aria-hidden>
                                {[1, 2, 3].map((i) => (
                                    <span
                                        key={i}
                                        className={cn('h-1.5 flex-1 rounded-full transition-colors', i <= strength.level
                                            ? strength.level === 1 ? 'bg-red-500' : strength.level === 2 ? 'bg-amber-500' : 'bg-emerald-600'
                                            : 'bg-neutral-200')}
                                    />
                                ))}
                            </div>
                            <p className="flex items-center gap-1 text-xs text-neutral-500">
                                {strength.level === 3 && <Check className="h-3.5 w-3.5 text-emerald-700" aria-hidden />}
                                {strength.label}. At least 6 characters; a mix of letters and numbers is safer.
                            </p>
                        </div>
                    )}
                </div>

                <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                    <TextField
                        label="Date of birth" name="dob" type="date" autoComplete="bday" required
                        min="1900-01-01" max={today} error={errors.dob} onBlur={onBlur('dob')}
                    />
                    <div className="space-y-1.5">
                        <Label htmlFor="gender" className="text-sm font-medium text-neutral-800">
                            <span>Gender<span className="ml-0.5 text-red-700" aria-hidden>*</span></span>
                        </Label>
                        <Select
                            name="gender" value={gender}
                            onValueChange={(v) => { setGender(v); setErrors((p) => ({ ...p, gender: undefined })); }}
                        >
                            <SelectTrigger id="gender" aria-invalid={errors.gender ? true : undefined} aria-describedby={errors.gender ? 'gender-error' : undefined} className="h-11 w-full md:h-10">
                                <SelectValue placeholder="Select" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="MALE">Male</SelectItem>
                                <SelectItem value="FEMALE">Female</SelectItem>
                                <SelectItem value="OTHER">Other</SelectItem>
                            </SelectContent>
                        </Select>
                        {errors.gender && <p id="gender-error" role="alert" className="text-sm text-red-700">{errors.gender}</p>}
                    </div>
                </div>

                <Button type="submit" size="lg" disabled={isLoading} className="h-11 w-full text-base">
                    {isLoading ? (<><Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Creating account...</>) : 'Create account'}
                </Button>
            </form>
        </AuthShell>
    );
}
