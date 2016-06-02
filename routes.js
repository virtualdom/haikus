const Boom = require('boom');
const Joi = require('joi');
const Moment = require('moment');
const Mongo = require('mongodb');

var connections = {};

function dbConnect (dbUrl, next) {
    if (connections[dbUrl]) return next(null, connections[dbUrl]);

    Mongo.MongoClient.connect(dbUrl, (error, connection) => {
        if (error) return next(error);

        connections[dbUrl] = connection;
        connection.on('close', () => {
            delete connections[dbUrl];
        });

        return next(null, connection);
    });
};

exports.register = (server, options, next) => {
    if (!options.credentials) return next(new Error('Missing credentials.'));

    server.auth.strategy('simple', 'basic', {
        validateFunc (request, username, password, next) {
            return next(null, (username === options.credentials.authPassword), {});
        }
    });

    server.route({
        method: 'GET',
        path: '/haikus',
        config: {
            handler (req, reply) {
                dbConnect(options.credentials.db, (error, client) => {
                    if (error) return reply(error);

                    client.collection('haikus')
                    .find({}, { _id: 0 })
                    .sort({ date: -1 })
                    .skip(req.query.page.number * req.query.page.size)
                    .limit(req.query.page.size)
                    .toArray((error, haikus) => {
                        if (error) return reply(error);

                        return reply({data: haikus});
                    });
                });
            },
            validate: {
                query: {
                    page: Joi.object().keys({
                        size: Joi.number().min(0).default(5).optional(),
                        number: Joi.number().min(0).default(0).optional()
                    }).default({
                        size: 5,
                        number: 0
                    })
                },
            },
            cors: true
        }
    });

    server.route({
        method: 'GET',
        path: '/haikus/{id}',
        config: {
            handler (req, reply) {
                dbConnect(options.credentials.db, (error, client) => {
                    if (error) return reply(error);

                    client.collection('haikus').findOne({id: req.params.id.toString()}, {_id: 0}, (error, haiku) => {
                        if (error) return reply(error);

                        return reply(haiku);
                    });
                });
            },
            validate: {
                params: {
                    id: Joi.string().regex(/^[0-9]+$/).required()
                }
            },
            cors: true
        }
    });

    server.route({
        method: 'POST',
        path: '/haikus',
        config: {
            handler (req, reply) {
                dbConnect(options.credentials.db, (error, client) => {
                    if (error) return reply(error);

                    var id = Moment().format('MMDDYYYY');
                    const haikus = client.collection('haikus');
                    haikus.findOne({ id }, (error, doesExist) => {
                        if (error) return reply(error);
                        if (doesExist) return reply(Boom.conflict('a haiku already exists for today'));



                        haikus.insert({
                            text: req.payload.text,
                            date: Moment().hour(12).minute(0).second(0).millisecond(0).toDate(),
                            id
                        }, (error) => {
                            if (error) return reply(error);

                            haikus.findOne({ id }, {_id: 0}, (error, haiku) => {
                                if (error) return reply(error);

                                return reply(haiku);
                            });
                        });
                    });
                });
            },
            validate: {
                payload: {
                    text: Joi.string().required()
                }
            },
            auth: 'simple'
        }
    });

    next();
};

exports.register.attributes = {
    name: 'haiku-routes',
    version: require('./package.json').version
};

