const https = require('https');

https.get('https://www.google.com', (res) => {
    console.log('statusCode:', res.statusCode);
    console.log('headers:', res.headers);
    res.on('data', (d) => {
        // consume
    });
}).on('error', (e) => {
    console.error(e);
});
