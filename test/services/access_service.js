'use strict';

var expect = require('norman-testing-tp').chai.expect;
var util = require('util');
var commonServer = require('norman-common-server');
var registry = commonServer.registry;
var NormanTestServer = require('norman-testing-server').server;

var AccessRestApi = require('../int/api/AccessRestApi');
var accessApi = new AccessRestApi();

var defaultRuleId = '*';
var TEST_TIMEOUT = 30000;
var standalone = true;

var testContext = {
    ip: '::1',
    user: {
        _id: '0',
        name: 'TEST'
    },
    request: {
        ip: '10.176.26.229',
        protocol: 'my.protocol',
        host: 'localhost',
        method: 'GET',
        url: '/api/someapi'
    }
};

var emailInBlackList = 'blacklist.in@example.com';

var defaultRule = {
    _id: defaultRuleId,
    scope: []
};

var domainGuestAccess = {
    _id: '@example.com',
    scope: [
        {
            name: 'access',
            permissions: ['guest']
        },
        {
            name: 'study',
            permissions: ['participant']
        },
        {
            name: 'project',
            permissions: ['collaborator']
        }
    ]
};

var domainNoAccess = {
    _id: '@noway.com',
    scope: [
        {
            name: 'study',
            permissions: ['participant']
        },
        {
            name: 'project',
            permissions: ['collaborator']
        }
    ]
};

var userSample = {
    _id: 'zUser@example.com',
    scope: [
        {
            name: 'access',
            permissions: ['guest']
        }
    ]
};

var userSampleToDelete = {
    _id: 'test@example.com',
    scope: [
        {
            name: 'access',
            permissions: ['guest']
        }
    ]
};

function testPassed(done) {
    return function () {
        done();
    };
}
function testFailed(done) {
    return function (err) {
        done(err || new Error('Test failed'));
    };
}

function dropCollection(db, collectionName) {
    if (db.collection(collectionName)) {
        return Promise.invoke(db, 'dropCollection', collectionName)
            .catch(function () {
                // ignore errors
            });
    }

    return Promise.resolve(1);
}

function dropAuthCollections() {
    var db = commonServer.db.connection.getDb('auth');
    return Promise.all([
        dropCollection(db, 'users'),
        dropCollection(db, 'authACLresources'),
        dropCollection(db, 'audits'),
        dropCollection(db, 'accessrules'),
        dropCollection(db, 'optouts')
    ]);
}

describe('Access services and REST API Test', function () {
    if (this.timeout() > 0 && this.timeout() < TEST_TIMEOUT) {
        // Do not override explicit timeout settings, e.g. through --timeout command line option when debugging
        this.timeout(TEST_TIMEOUT);
    }

    before(function (done) {
        var optOutService;

        dropAuthCollections()
            .then(function () {
                return accessApi.initialize();
            })
            .then(function () {
                optOutService = registry.getModule('OptOutService');
                return Promise.invoke(optOutService, 'onInitialized');
            })
            .then(function () {
                return optOutService.add(emailInBlackList, testContext);
            })
            .then(function () {
                if (NormanTestServer.appServer && NormanTestServer.appServer.status === 'started') {
                    standalone = false;
                    return done();
                }

                standalone = true;
                NormanTestServer.initialize(path.resolve(__dirname, '../bin/config-test.json'))
                    .callback(done);
            });
    });

    after(function (done) {
        if (!standalone) {
            return done();
        }

        NormanTestServer.shutdown().callback(done);
    });

    it('should be exposed through Norman registry', function (done) {
        var accessService = commonServer.registry.getModule('AccessService');
        expect(accessService).to.exist;
        done();
    });

    it('should support create API', function (done) {
        var accessService = commonServer.registry.getModule('AccessService');
        accessService.create(defaultRule, testContext)
            .then(function (createdDefaultRule) {
                expect(createdDefaultRule).to.exist;
                expect(createdDefaultRule._id).to.be.equal(defaultRule['_id']);
                return accessService.create(userSampleToDelete, testContext);
            })
            .then(function (createdUserRule) {
                expect(createdUserRule).to.exist;
                expect(createdUserRule._id).to.be.equal(userSampleToDelete['_id']);
                return accessService.create(userSample, testContext);
            })
            .then(function (createdUserRule) {
                expect(createdUserRule).to.exist;
                expect(createdUserRule._id).to.be.equal(userSample['_id']);
            })
            .then(testPassed(done), testFailed(done));
    });

    it('should not add twice the same id', function (done) {
        var accessService = commonServer.registry.getModule('AccessService');
        accessService.create(domainGuestAccess)
            .then(function (/*createRule*/) {
                return accessService.create(domainGuestAccess, testContext);
            })
            .catch(function (err) {
                expect(err).to.exist;
            })
            .then(testPassed(done), testFailed(done));
    });

    it('should support update API', function (done) {
        var accessService = commonServer.registry.getModule('AccessService');
        var updatedDomainSample = {};
        util._extend(updatedDomainSample, domainGuestAccess);
        updatedDomainSample.scope[0]['permissions'][0] = 'standard';
        accessService.update(updatedDomainSample, testContext)
            .then(function (updatedRule) {
                expect(updatedRule.scope[0]['permissions'][0]).to.be.equal('standard');
            })
            .then(testPassed(done), testFailed(done));
    });

    it('should support getAccessById API', function (done) {
        var accessService = commonServer.registry.getModule('AccessService');
        accessService.getAccessById(domainGuestAccess._id)
            .then(function (domainRule) {
                expect(domainRule).to.exist;
                expect(domainRule.scope.length).to.be.equal(3);
            })
            .then(testPassed(done), testFailed(done));
    });

    it('should support set API', function (done) {
        var accessService = commonServer.registry.getModule('AccessService');
        accessService.set(domainNoAccess, testContext)
            .then(function (accessRule) {
                expect(accessRule).to.exist;
                expect(accessRule._id).to.be.equal(domainNoAccess['_id']);
                return accessService.set(domainNoAccess, testContext);
            })
            .then(function (accessRule) {
                expect(accessRule).to.exist;
                expect(accessRule._id).to.be.equal(domainNoAccess['_id']);
            })
            .then(testPassed(done), testFailed(done));
    });

    it('should support get with filtering order', function (done) {
        var accessService = commonServer.registry.getModule('AccessService');
        var options = {};
        options['filter'] = {$in: [ /^@/i, accessService.getDefaultDomainID()] };
        options['sort'] = {_id: 1};
        accessService.get(options)
            .then(function (values) {
                expect(values['nbTotalRules']).to.be.equals(5);
                expect(values['accessRules'].length).to.be.equals(3);
                expect(values['accessRules'][0]['_id']).to.be.equals('*');
                expect(values['accessRules'][1]['_id']).to.be.equals('@noway.com');
                expect(values['accessRules'][2]['_id']).to.be.equals('@example.com');
            })
            .then(testPassed(done), testFailed(done));
    });

    it('should support delete API', function (done) {
        var accessService = commonServer.registry.getModule('AccessService');
        accessService.delete(userSampleToDelete._id)
            .then(function () {
                return accessService.get();
            })
            .then(function (values) {
                expect(values['nbTotalRules']).to.be.equals(4);
            })
            .then(testPassed(done), testFailed(done));
    });

    it('should support delete API with an unknown user', function (done) {
        var accessService = commonServer.registry.getModule('AccessService');
        accessService.delete('notKnown@john.doe')
            .then(function () {
                return accessService.get();
            })
            .then(function (values) {
                expect(values['nbTotalRules']).to.be.equals(4);
            })
            .then(testPassed(done), testFailed(done));
    });

    it('should support getPermissions - registered address ', function (done) {
        var accessService = commonServer.registry.getModule('AccessService');
        accessService.getPermissions('zUser@example.com', 'access')
            .then(function (permissions) {
                expect(permissions.length).to.be.equals(1);
                expect(permissions[0]).to.be.equals('guest');
            })
            .then(testPassed(done), testFailed(done));
    });

    it('should support getPermissions - unregistered address/registered domain', function (done) {
        var accessService = commonServer.registry.getModule('AccessService');
        accessService.getPermissions('unregisteredUser@example.com', 'study')
            .then(function (permissions) {
                expect(permissions.length).to.be.equals(1);
                expect(permissions[0]).to.be.equals('participant');
            })
            .then(testPassed(done), testFailed(done));
    });

    it('should support getPermissions - unregistered address/unregistered domain', function (done) {
        var accessService = commonServer.registry.getModule('AccessService');
        accessService.getPermissions('unregisteredUser@pas.com', 'study')
            .then(function (permissions) {
                expect(permissions.length).to.be.equals(0);
            })
            .then(testPassed(done), testFailed(done));
    });

    it('should support getRoles', function (done) {
        var accessService = commonServer.registry.getModule('AccessService');
        var roles = accessService.getRoles('access', ['standard']);
        expect(roles.length).to.be.equals(1);
        done();
    });

    it('should support inviteUsers API, study', function (done) {
        var accessService = commonServer.registry.getModule('AccessService');
        accessService.inviteUsers(['toto@example.com', emailInBlackList, 'titi@noway.com', 'tutu@noknown.com', userSample['_id']], 'study', testContext)
            .then(function (invitationResult) {
                expect(invitationResult.length).to.be.equals(5);
                invitationResult.forEach(function (invitedUser) {
                    if (invitedUser.emailAddress === 'toto@example.com') {
                        expect(invitedUser.successfullyProvisioned).to.be.equals(true);
                        expect(invitedUser.acceptNotification).to.be.equals(true);
                    } else if (invitedUser.emailAddress === emailInBlackList) {
                        expect(invitedUser.successfullyProvisioned).to.be.equals(true);
                        expect(invitedUser.acceptNotification).to.be.equals(false);
                    } else if (invitedUser.emailAddress === 'titi@noway.com') {
                        expect(invitedUser.successfullyProvisioned).to.be.equals(true);
                        expect(invitedUser.acceptNotification).to.be.equals(true);
                    } else if (invitedUser.emailAddress === 'tutu@noknown.com') {
                        expect(invitedUser.successfullyProvisioned).to.be.equals(false);
                        expect(invitedUser.acceptNotification).to.be.equals(true);
                    } else if (invitedUser.emailAddress === userSample['_id']) {
                        expect(invitedUser.successfullyProvisioned).to.be.equals(true);
                        expect(invitedUser.acceptNotification).to.be.equals(true);
                    }
                });
            })
            .then(testPassed(done), testFailed(done));
    });

    it('should support inviteUsers API, projects', function (done) {
        var accessService = commonServer.registry.getModule('AccessService');
        accessService.inviteUsers(['toto@example.com', emailInBlackList, 'titi@noway.com', 'tutu@noknown.com', userSample['_id']], 'project', testContext)
            .then(function (invitationResult) {
                expect(invitationResult.length).to.be.equals(5);
                invitationResult.forEach(function (invitedUser) {
                    if (invitedUser.emailAddress === 'toto@example.com') {
                        expect(invitedUser.successfullyProvisioned).to.be.equals(true);
                        expect(invitedUser.acceptNotification).to.be.equals(true);
                    } else if (invitedUser.emailAddress === emailInBlackList) {
                        expect(invitedUser.successfullyProvisioned).to.be.equals(true);
                        expect(invitedUser.acceptNotification).to.be.equals(false);
                    } else if (invitedUser.emailAddress === 'titi@noway.com') {
                        expect(invitedUser.successfullyProvisioned).to.be.equals(true);
                        expect(invitedUser.acceptNotification).to.be.equals(true);
                    } else if (invitedUser.emailAddress === 'tutu@noknown.com') {
                        expect(invitedUser.successfullyProvisioned).to.be.equals(false);
                        expect(invitedUser.acceptNotification).to.be.equals(true);
                    } else if (invitedUser.emailAddress === userSample['_id']) {
                        expect(invitedUser.successfullyProvisioned).to.be.equals(true);
                        expect(invitedUser.acceptNotification).to.be.equals(true);
                    }
                });
            })
            .then(testPassed(done), testFailed(done));
    });

    it('should support removeExpirationDate API', function (done) {
        var accessService = commonServer.registry.getModule('AccessService');
        accessService.removeExpirationDate('titi@noway.com', testContext)
            .then(function (updatedRule) {
                expect(updatedRule).to.exist;
                expect(updatedRule.proposed_at).to.be.null;
            })
            .then(testPassed(done), testFailed(done));
    });

    it('should support hasAccess API, positive answer', function (done) {
        var user = {email: 'titi@noway.com'};
        accessApi.hasAccess(user, 200, function (err, res) {
            expect(err).to.be.eq(null);
            expect(res).to.exist;
            expect(res.text).to.be.equals('1');
            done();
        });
    });

    it('should support hasAccess API, negative answer', function (done) {
        var user = {email: 'test@nodomain.com'};
        accessApi.hasAccess(user, 200, function (err, res) {
            expect(err).to.be.eq(null);
            expect(res).to.exist;
            expect(res.text).to.be.equals('0');
            done();
        });
    });

    it('should grant access for users who exist in the db', function (done) {
        // hasAccess should return 1 even if the user's domain is not defined but they exist in the DB, even if they have no permissions.
        var accessService = commonServer.registry.getModule('AccessService'),
            userService = commonServer.registry.getModule('UserService'),
            DOMAIN = '@subdomain.unique.enough.example.org',
            EMAIL = 'zUser' + DOMAIN,
            myUser = {
                email: EMAIL,
                name: 'John Doe'
            },
            hasAccessUser = {email: EMAIL},
            allAccessDomain = {
                _id: DOMAIN,
                scope: [
                    {name: 'access', permissions: ['standard']},
                    {name: 'study', permissions: ['participant']},
                    {name: 'project', permissions: ['collaborator']}
                ]
            },
            createdDomain;

        // Create domain
        accessService.create(allAccessDomain, testContext)
            .then(function (domain) {
                // create user
                createdDomain = domain;
                return userService.createUser(myUser, null, testContext);
            })
            .then(function () {
                // check access
                return accessApi.hasAccess(hasAccessUser, 200, function (err, res) {
                    expect(err).to.be.eq(null);
                    expect(res).to.exist;
                    expect(res.text).to.be.equals('1');
                });
            })
            .then(function () {
                // delete domain
                return accessService.delete(createdDomain._id, testContext);
            })
            .then(function () {
                // check access again
                return accessApi.hasAccess({email: EMAIL.toUpperCase()}, 200, function (err, res) {
                    expect(err).to.be.eq(null);
                    expect(res).to.exist;
                    expect(res.text).to.be.equals('1');
                });
            })
            .then(testPassed(done), testFailed(done));
    });
});
