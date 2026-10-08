import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
    resolve: {
        alias: {
            '@': path.resolve(import.meta.dirname, 'src'),
            'server-only': path.resolve(import.meta.dirname, 'tests/helpers/empty.ts'),
        },
    },
    test: {
        environment: 'node',
        include: ['tests/*.test.ts'],
        setupFiles: ['tests/helpers/setup.ts'],
        testTimeout: 15000,
    },
});
