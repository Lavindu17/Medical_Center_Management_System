import { SignJWT } from 'jose';

export type Role = 'ADMIN' | 'DOCTOR' | 'PATIENT' | 'PHARMACIST' | 'LAB_ASSISTANT' | 'RECEPTIONIST';

export async function tokenFor(role: Role, id = 1, secret = process.env.JWT_SECRET!) {
    return new SignJWT({ id, email: `${role.toLowerCase()}@test.local`, role, name: role })
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt()
        .setExpirationTime('1d')
        .sign(new TextEncoder().encode(secret));
}
