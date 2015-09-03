'use strict';

var commonServer = require('norman-common-server');
var serviceLogger = commonServer.logging.createLogger('acl-service');
var config = commonServer.config;

var NodeAclFacade = require('./nodeAclFacade');
var aclModel = require('./acl.model');

var registry = commonServer.registry;
var userService;
var AclModel;

function AclService() {
}

module.exports = AclService;

AclService.prototype.initialize = function (done) {
    serviceLogger.info('initialize');
    this._roles = config.get('security').roles || {globalRoles: [], projectRoles: []};
    if (!this.acl) {
        this.acl = new NodeAclFacade();
        this.acl.initialize();
    }
    AclModel = aclModel.create();
    done();
};

AclService.prototype.shutdown = function (done) {
    serviceLogger.info('shutdown');
    if (typeof done === 'function') {
        done();
    }
};

AclService.prototype.onInitialized = function (done) {
    serviceLogger.info('onInitialized');
    userService = registry.getModule('UserService');
    this.acl.onInitialized();
    done();

};

AclService.prototype.checkSchema = function (done) {
    serviceLogger.info('checkSchema');
    var aclModel = require('./acl.model.js');
    aclModel.createIndexes(done);
};

/**
 * initializeSchema
 * @param {function} done
 */
AclService.prototype.initializeSchema = function (done) {
    serviceLogger.info('initializeSchema');
    var systemContext = {
        ip: '::1',
        user: {
            _id: '0',
            name: 'SYSTEM'
        }
    };
    var roles = (config.get('security').roles && config.get('security').roles.globalRoles) ? config.get('security').roles.globalRoles : [];
    if (!this.acl) {
        this.acl = new NodeAclFacade();
        this.acl.initialize();
    }
    this.acl.allowEx(roles, systemContext, done);
};

AclService.prototype.getAcl = function () {
    return this.acl;
};

/**
 * Remove a certain role from a user
 * @return (type) description
 */
AclService.prototype.removeUserRole = function (userId, role, context) {
    serviceLogger.info('removeUserRole');
    return this.acl.removeUserRoles(userId, role, context);
};

/**
 * Remove all roles of a user
 * @return (type) description
 */
AclService.prototype.removeUserRoles = function (userId, context) {
    var self = this;
    serviceLogger.info('removeUserRoles');
    return this.acl.userRoles(userId)
            .then(function (roles) {
                if (roles && roles.length > 0) {
                    self.acl.removeUserRoles(userId, roles, context);
                }
            })
            .then(function () {
                return self.acl.removeRole(userId, context);
            });
};

/**
 * Remove all rights to a certain project from a user
 * @return (type) description
 */
AclService.prototype.removeProjectAccess = function (userId, projectId, context) {
    serviceLogger.info('removeProjectAccess', 'owner-' + projectId, 'collaborator-' + projectId);
    return this.acl.removeUserRoles(userId, ['owner-' + projectId, 'collaborator-' + projectId], context);
};

/**
 * Remove all roles related to a certain project
 * @return (type) description
 */
AclService.prototype.removeProjectRoles = function (projectId, context) {
    var promises = [], roles, role, k, n, sRole;
    serviceLogger.info('removeProjectRoles', 'owner-' + projectId, 'collaborator-' + projectId);
    roles = this._roles.projectRoles || [];
    for (k = 0, n = roles.length; k < n; ++k) {
        role = roles[k];
        sRole = JSON.stringify(role.roles);
        if (sRole.indexOf('projectId') !== -1) {
            promises.push(this.acl.removeRole(JSON.parse(sRole.replace(/projectId/g, projectId)), context));
        }
    }
    return Promise.all(promises);
};

/**
 * Create project specific roles (owner/collaborator)
 * @return (type) description
 */
AclService.prototype.createAclProjectRoles = function (projectId, context) {
    var promises = [], roles, role, k, n, sRole;
    serviceLogger.info('createAclProjectRoles>>projectId>>', projectId);
    roles = this._roles.projectRoles || [];
    for (k = 0, n = roles.length; k < n; ++k) {
        role = roles[k];
        sRole = JSON.stringify(role);
        if (sRole.indexOf('projectId') !== -1) {
            promises.push(this.acl.allowEx([JSON.parse(sRole.replace(/projectId/g, projectId))], context));
        }
    }
    return Promise.all(promises);
};

AclService.prototype.grantUserRole = function (userId, roles, context) {
    serviceLogger.info('grantUserRole>>granting role ' + roles + ' to ' + userId);
    return this.acl.addUserRoles(userId, roles, context);
};

// Should be deleted at some point
AclService.prototype.grantAdminRole = function (user, context) {
    // HACK - fix the admin issues on BUILD ...
    var self = this;
    return this.grantUserRole(user._id.toString(), 'standard', context)
            .then(function () {
                return self.grantUserRole(user._id.toString(), 'admin', context);
            });
};

// Should be deleted at some point
AclService.prototype.grantStandardRole = function (user) {
    return this.grantUserRole(user._id.toString(), 'standard');
};

/**
 * Create admin user or assign admin role to an existing user
 * @param   {object}    admin  name, email, (optional) password
 * @param   {object}  context     context
 */
AclService.prototype.createAdmin = function (admin, context) {
    var self = this;
    serviceLogger.info('createAdmin ');
    if (!admin) {
        return Promise.reject(new TypeError('Invalid admin parameter'));
    }

    var newUser = {
        principal: admin.email,
        name: admin.name,
        email: admin.email,
        password: admin.password,
        provider: 'local'
    };
    var adminUser;

    return userService.GetUserByEmail(admin.email)
            .then(function (user) {
                if (user) {
                    adminUser = user;
                    return self.acl.addUserRoles(user._id.toString(), 'admin', context);
                }
                return userService.createAdminUser(newUser, context)
                        .then(function (createdUser) {
                            adminUser = createdUser;
                            return self.acl.addUserRoles(createdUser._id.toString(), 'admin', context);
                        });
            })
            .then(function () {
                return adminUser;
            })
            .catch(serviceLogger.error);
};

/**
 * Unassign admin role from an existing user
 * @param   {object}    admin  name, email, (optional) password
 * @param   {object}  context     context
 */
AclService.prototype.unassignAdmin = function (admin, context) {
    var adminUser, self = this;
    if (!admin) {
        return Promise.reject(new TypeError('Invalid admin parameter'));
    }
    serviceLogger.debug('Revoking admin role from user ' + admin.email);

    return userService.GetUserByEmail(admin.email)
            .then(function (user) {
                if (user) {
                    adminUser = user;
                    serviceLogger.debug('Revoking admin role from user ' + admin.email);
                    return self.acl.removeUserRoles(user._id.toString(), 'admin', context);
                }
                serviceLogger.info('Cannot revoke admin role from unknown user ' + admin.email);
            })
            .then(function () {
                return adminUser;
            })
            .catch(serviceLogger.error);
};

AclService.prototype.checkAllowed = function (numPathComponents, userId, actions) {
    var aclFacade = this.getAcl();

    function httpError(errorCode, msg, res) {
        return res.status(errorCode).json({message: msg});
    }

    return function (req, res, next) {
        var _userId = userId, resource, url;

        // call function to fetch userId
        if (typeof userId === 'function') {
            _userId = userId(req, res);
        }

        if (!userId) {
            if (req.session && (req.session.userId)) {
                _userId = req.session.userId;
            }
            else {
                serviceLogger.info('checkAllowed(), insufficient permissions');
                httpError(403, 'Insufficient permissions to access resource', res);
                return;
            }
        }

        // Issue #80 - Additional check
        if (!_userId) {
            serviceLogger.info('checkAllowed(), insufficient permissions');
            httpError(403, 'Insufficient permissions to access resource', res);
            return;
        }

        url = req.originalUrl.split('?')[0];
        if (!numPathComponents) resource = url;

        else resource = url.split('/').slice(0, numPathComponents + 1).join('/');

        if (!actions) actions = req.method.toLowerCase();

        serviceLogger.info('Requesting ' + actions + ' on ' + resource + ' by user ' + _userId);

        aclFacade.isAllowed(_userId, resource, actions, function (err, allowed) {
            if (err) {
                serviceLogger.error('checkAllowed(), Issue with resource');
                httpError(500, 'Error checking permissions to access resource', res);
            }
            else if (allowed === false) {
                serviceLogger.info('checkAllowed(), not allowed [' + actions +
                        '] on [' + resource + '] by user [' + _userId + ']');

                httpError(403, 'Insufficient permissions to access resource', res);
            }
            else {
                serviceLogger.info('Allowed ' + actions + ' on ' + resource + ' by user ' + _userId);
                next();
            }
        });
    };
};

AclService.prototype.upgrade_0_1_0 = function () {
    serviceLogger.debug('Running upgrade_0_1_0');
    var promises = [];
    var systemContext = {
        ip: '::1',
        user: {
            _id: '0',
            name: 'SYSTEM'
        }
    };
    var acl = new NodeAclFacade();

    // This regexp matches '/api/project/<projectid>/studies
    var myRegex = /\/api\/projects\/([^\/]+)\/studies/i;
    acl.initialize();
    return Promise.resolve(AclModel.find({_bucketname: {$regex: myRegex}, key: {$regex: /owner/i}}).lean().exec())
            .then(function (acls) {
                promises = [];
                acls.forEach(function (item) {
                    var bn = myRegex.exec(item._bucketname);
                    if (bn) {
                        var projectId = bn[1];
                        promises.push(acl.allowEx([
                            {
                                roles: item.key,
                                allows: [
                                    {
                                        resources: '/api/projects/' + projectId + '/revoke',
                                        permissions: ['delete']
                                    }
                                ]
                            }
                        ], systemContext));
                    }
                });
                return Promise.all(promises);
            })
            .then(function () {
                return acl.allowEx([
                    {
                        roles: ['standard'],
                        allows: [
                            {
                                resources: '/api/projects',
                                permissions: ['put', 'post', 'patch', 'get', 'delete']
                            }
                        ]
                    }
                ], systemContext);
            })
            .then(function () {
                return acl.removeResource('/api/projects/', systemContext);
            });
};

AclService.prototype.upgradeSchema = function (version, done) {
    serviceLogger.debug('upgradeSchema');
    var job = Promise.resolve(true);
    var self = this;
    switch (version.major) {
    case 0:
        switch (version.minor) {
        case 0:
            job = job.then(self.upgrade_0_1_0);
        }
    }
    return job.callback(done);
};
