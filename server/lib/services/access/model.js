'use strict';

var commonServer = require('norman-common-server');
var mongoose = commonServer.db.mongoose;
var schema = mongoose.Schema;
var serviceLogger = commonServer.logging.createLogger('accessRule-model');
var AccessRule;

// Validity period of an access rule in seconds
var VALIDITY_PERIOD = 7 * 24 * 60 * 60;

var scopeSchema = schema({
    name: {type: String, trim: true},
    permissions: {type: [String], trim: true}
}, {_id: false, versionKey: false});

var accessRuleSchema = mongoose.createSchema('accessRule', {
    _id: {type: String},
    scope: {type: [scopeSchema]},
    proposed_at: {type: Date, expires: VALIDITY_PERIOD},
    created_at: {type: Date, default: Date.now}
});

accessRuleSchema.set('autoIndex', false);
accessRuleSchema.index({created_at: 1});

function create() {
    serviceLogger.debug('creating accessPolicy model');

    if (!AccessRule) {
        AccessRule = mongoose.createModel('AccessRule', accessRuleSchema, undefined, {cache: false});
    }

    return AccessRule;
}
function createIndexes(done) {
    serviceLogger.debug('Checking accessPolicy model indexes');
    AccessRule.ensureIndexes();
    AccessRule.on('index', function (err) {
        if (err) {
            serviceLogger.error(err, 'Failed to create indexes for accessPolicy collection');
            done(err);
        }
        else {
            serviceLogger.debug('accessPolicy collection indexes verified');
            done();
        }
    });
}

function destroy() {
    serviceLogger.debug('destroy accessRule model');
    AccessRule = undefined;
}

module.exports = {
    create: create,
    destroy: destroy,
    createIndexes: createIndexes
};
