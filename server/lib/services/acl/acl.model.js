'use strict';
var commonServer = require('norman-common-server');
var mongoose = commonServer.db.mongoose;

var AclSchema = mongoose.createSchema('auth', {
    _id: mongoose.Schema.Types.ObjectId,
    _bucketname: String,
    key: String
});

var AclModel;
var logger = commonServer.logging.createLogger('acl-service');

AclSchema.set('autoIndex', false);
AclSchema.index({_bucketname: 1, key: 1}, { unique: true});

function createIndexes(done) {
    logger.debug('Checking ACL model indexes');
    if (!AclModel) {
        create();
    }

    AclModel.ensureIndexes();
    AclModel.on('index', function (err) {
        if (err) {
            logger.error(err, 'Failed to create indexes for ACL collection');
            done(err);
        }
        else {
            logger.debug('ACL collection indexes verified');
            done();
        }
    });
}

function create() {
    logger.debug('>> create(), creating ACL model');

    if (!AclModel) {
        AclModel = mongoose.createModel('Acl', AclSchema, 'authACLresources');
    }

    return AclModel;
}

module.exports = {
    createIndexes: createIndexes,
    create: create
};
