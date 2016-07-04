const Basic = require('hapi-auth-basic');
const Hapi = require('hapi');

const credentials = require('./credentials');

const server = new Hapi.Server({
    connections: {
        router: {
            stripTrailingSlash: true
        }
    }
});

server.connection({ port: process.env.PORT || 80 });

server.register([
    Basic,
    { register: require('./routes'), options: { credentials }}
], (error) => {
    if (error) throw (error);

    if (!module.parent) server.start(() => {
        console.log('Sever started!');
    });
});

process.on('SIGTERM', () => {
    server.stop({timeout: 5 * 1000}, () => {
        process.exit(0);
    });
});

module.exports = server;

