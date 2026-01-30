const nodemailer = require('nodemailer');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

// Manually load .env.local
try {
    const envPath = path.resolve(__dirname, '../.env.local');
    if (fs.existsSync(envPath)) {
        const envConfig = dotenv.parse(fs.readFileSync(envPath));
        // Add to process.env
        for (const k in envConfig) {
            process.env[k] = envConfig[k];
        }
        console.log('Loaded .env.local');
    } else {
        console.log('.env.local not found, relying on existing env');
    }
} catch (e) {
    console.log('Error loading .env.local:', e.message);
}

async function main() {
    console.log('Testing Email Sending...');
    console.log('SMTP_HOST:', process.env.SMTP_HOST);
    console.log('SMTP_PORT:', process.env.SMTP_PORT);
    console.log('SMTP_SECURE:', process.env.SMTP_SECURE);
    console.log('SMTP_USER:', process.env.SMTP_USER);

    const port = parseInt(process.env.SMTP_PORT || '587');
    const secure = process.env.SMTP_SECURE === 'true';

    console.log(`Parsed Port: ${port}, Secure: ${secure} (FORCED TEST)`);

    const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST || 'smtp.gmail.com',
        port: port,
        secure: secure,
        auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS,
        },
        logger: true,
        debug: true
    });

    try {
        console.log('Verifying connection...');
        await transporter.verify();
        console.log('Server connection verification success.');

        console.log('Sending test email to self...');
        const sendInfo = await transporter.sendMail({
            from: process.env.SMTP_FROM || process.env.SMTP_USER,
            to: process.env.SMTP_USER, // Send to self
            subject: 'Test Email Debug',
            text: 'This is a test email from the debugger script.',
        });
        console.log('Email sent successfully!');
        console.log('Message ID:', sendInfo.messageId);
    } catch (err) {
        console.error('Error occurred:');
        console.error(err);
    }
}

main();
