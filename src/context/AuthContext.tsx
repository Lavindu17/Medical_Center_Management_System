'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { User } from '@/types';
import { useRouter } from 'next/navigation';

interface AuthContextType {
    user: User | null;
    loading: boolean;
    login: (user: User) => void;
    logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const router = useRouter();

    useEffect(() => {
        checkSession();
    }, []);

    const checkSession = async () => {
        try {
            const res = await fetch('/api/auth/session');
            if (res.ok) {
                const data = await res.json();
                setUser(data.user);
            } else {
                setUser(null);
            }
        } catch (error) {
            console.error('Session check failed', error);
            setUser(null);
        } finally {
            setLoading(false);
        }
    };

    const login = (userData: User) => {
        setUser(userData);
        // Redirect based on role
        switch (userData.role) {
            case 'PATIENT':
                router.push('/patient');
                break;
            case 'DOCTOR':
                router.push('/doctor');
                break;
            case 'ADMIN':
                router.push('/admin');
                break;
            case 'PHARMACIST':
                router.push('/pharmacist');
                break;
            case 'LAB_ASSISTANT':
                router.push('/lab-assistant');
                break;
            case 'RECEPTIONIST':
                router.push('/receptionist');
                break;
            default:
                router.push('/');
        }
    };

    const logout = async () => {
        try {
            // Call logout API to clear cookie
            await fetch('/api/auth/logout', { method: 'POST' });
            setUser(null);
            router.push('/login');
        } catch (error) {
            console.error('Logout failed', error);
        }
    };

    return (
        <AuthContext.Provider value={{ user, loading, login, logout }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
}
