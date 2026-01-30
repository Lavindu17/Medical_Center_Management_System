const net = require('net');

const host = 'smtp.ethereal.email';
const port = 587;

console.log(`Connecting to ${host}:${port}...`);
const client = net.createConnection({ port, host }, () => {
    console.log('connected to server!');
});

client.on('data', (data) => {
    console.log('Received: ' + data.toString());
    client.end();
});

client.on('end', () => {
    console.log('disconnected from server');
});

client.on('error', (err) => {
    console.log('ERROR:', err);
});
