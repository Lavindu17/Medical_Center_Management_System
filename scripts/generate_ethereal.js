const nodemailer = require('nodemailer');

async function main() {
    try {
        const testAccount = await nodemailer.createTestAccount();
        console.log('ETHEREAL_USER=' + testAccount.user);
        console.log('ETHEREAL_PASS=' + testAccount.pass);
    } catch (err) {
        console.error('Failed to create test account:', err);
    }
}

main();
