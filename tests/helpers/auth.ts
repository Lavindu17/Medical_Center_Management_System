import { SignJWT } from 'jose';

export type Role = 'ADMIN' | 'DOCTOR' | 'PATIENT' | 'PHARMACIST' | 'LAB_ASSISTANT' | 'RECEPTIONIST' | 'HR_MANAGER';

export async function tokenFor(role: Role, id = 1, secret = process.env.JWT_SECRET!, issuedAt?: number) {
    return new SignJWT({ id, email: `${role.toLowerCase()}@test.local`, role, name: role })
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt(issuedAt)
        .setExpirationTime('1d')
        .sign(new TextEncoder().encode(secret));
}
