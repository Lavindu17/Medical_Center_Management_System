import { defineConfig } from 'vitest/config';
import path from 'path';
import dotenv from 'dotenv';
import os from 'os';

// Credentials come from .env.local, but the database is ALWAYS the isolated test schema.
dotenv.config({ path: '.env.local', quiet: true });
export const TEST_DB = 'sethro_medical_test';

export default defineConfig({
    resolve: {
        alias: {
            '@': path.resolve(import.meta.dirname, 'src'),
            'server-only': path.resolve(import.meta.dirname, 'tests/helpers/empty.ts'),
        },
    },
    test: {
        environment: 'node',
        include: ['tests/integration/**/*.test.ts'],
        globalSetup: ['tests/integration/global-setup.ts'],
        setupFiles: ['tests/integration/setup.ts'],
        fileParallelism: false,
        testTimeout: 30000,
        hookTimeout: 60000,
        env: {
            MYSQL_HOST: process.env.MYSQL_HOST ?? 'localhost',
            MYSQL_PORT: process.env.MYSQL_PORT ?? '3306',
            MYSQL_USER: process.env.MYSQL_USER ?? 'root',
            MYSQL_PASSWORD: process.env.MYSQL_PASSWORD ?? '',
            MYSQL_DATABASE: TEST_DB,
            JWT_SECRET: 'integration-test-secret',
            UPLOAD_DIR: path.join(os.tmpdir(), 'sethro-test-uploads'),
        },
    },
});
