const net = require('net');

console.log('Connecting to smtp.gmail.com:587...');
const client = net.createConnection({ port: 587, host: 'smtp.gmail.com' }, () => {
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
