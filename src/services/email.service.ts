import nodemailer from 'nodemailer';

// Check if we have credentials for real email
const hasCredentials = process.env.SMTP_USER && process.env.SMTP_PASS;

const transporter = hasCredentials ? nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: process.env.SMTP_SECURE === 'true', // Defaults to false if not set to 'true'
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
    },
    logger: true,
    debug: true,
    connectionTimeout: 10000, // 10 seconds
}) : null;

export const EmailService = {
    async sendEmail(to: string, subject: string, html: string) {
        // If no credentials or in dev/mock mode, just log
        if (!transporter) {
            console.log('DATA_MOCK_EMAIL_SEND: ---------------------------------------------------');
            console.log(`To: ${to}`);
            console.log(`Subject: ${subject}`);
            console.log('Content (HTML preview):', html.replace(/<[^>]*>?/gm, '').substring(0, 100) + '...');
            console.log('Full Code likely in HTML above.');
            console.log('-------------------------------------------------------------------------');
            return { messageId: 'mock-id-no-creds' };
        }

        try {
            console.log('DEBUG: Attempting to send email via SMTP...');
            console.log('DEBUG: Config:', {
                host: process.env.SMTP_HOST,
                port: process.env.SMTP_PORT,
                user: process.env.SMTP_USER,
                hasPass: !!process.env.SMTP_PASS
            });

            const info = await transporter.sendMail({
                from: process.env.SMTP_FROM || '"Sethro Medical" <no-reply@sethro.com>',
                to,
                subject,
                html,
            });
            console.log('Email sent: %s', info.messageId);
            // Log the preview URL for Ethereal accounts
            const previewUrl = nodemailer.getTestMessageUrl(info);
            if (previewUrl) {
                console.log('-------------------------------------------------------------------------');
                console.log('📧 Ethereal Email Preview (Click to view):');
                console.log(previewUrl);
                console.log('-------------------------------------------------------------------------');
            }
            return info;
        } catch (error) {
            console.error('Error sending email:', error);
            // In dev, we might want to just log instead of failing
            if (process.env.NODE_ENV === 'development') {
                console.log('DEV MODE: Email would have been sent to', to);
                console.log('Subject:', subject);
                console.log('Content:', html);
                return { messageId: 'dev-mock-id' };
            }
            throw error;
        }
    },

    async sendVerificationEmail(to: string, code: string) {
        const subject = 'Verify your email - Sethro Medical Center';
        const html = `
            <div style="font-family: sans-serif; padding: 20px;">
                <h2>Welcome to Sethro Medical Center!</h2>
                <p>Please use the following code to verify your email address:</p>
                <h1 style="color: #2563eb; letter-spacing: 5px;">${code}</h1>
                <p>This code will expire in 15 minutes.</p>
                <p>If you didn't request this, please ignore this email.</p>
            </div>
        `;
        return this.sendEmail(to, subject, html);
    },

    async sendPasswordResetEmail(to: string, code: string) {
        const subject = 'Reset your password - Sethro Medical Center';
        const html = `
            <div style="font-family: sans-serif; padding: 20px;">
                <h2>Password Reset Request</h2>
                <p>You requested to reset your password. Use this code to proceed:</p>
                <h1 style="color: #dc2626; letter-spacing: 5px;">${code}</h1>
                <p>This code will expire in 15 minutes.</p>
                <p>If you didn't request this, please ignore this email.</p>
            </div>
        `;
        return this.sendEmail(to, subject, html);
    },
};
