import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
    resolve: {
        alias: {
            '@': path.resolve(__dirname, 'src'),
            'server-only': path.resolve(__dirname, 'tests/helpers/empty.ts'),
        },
    },
    test: {
        environment: 'node',
        include: ['tests/**/*.test.ts'],
        setupFiles: ['tests/helpers/setup.ts'],
        testTimeout: 15000,
    },
});
