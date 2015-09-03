'use strict';
var commonServer = require('norman-common-server');
var registry = commonServer.registry;

var accessService, userService;

module.exports.hasAccess = function (req, res) {
    if (!accessService) {
        accessService = registry.lookupModule('AccessService');
        if (!accessService) {
            res.status(500).json(new commonServer.CommonError('Access service not initialized', 500));
            return;
        }
    }
    if (!userService) {
        userService = registry.lookupModule('UserService');
        if (!userService) {
            res.status(500).json(new commonServer.CommonError('User service not initialized', 500));
            return;
        }
    }

    if (!req.body || !req.body.email) {
        res.status(400).end();
        return;
    }

    userService.getUserByEmail(req.body.email, true)
        .then(function (user) {
            if (!user) {
                // no user found, try the permissions
                return accessService.getPermissions(req.body.email, 'access')
                    .then(function (permissions) {
                        return permissions && permissions.length > 0;
                    });
            }
            // otherwise, we found a user, he can access
            return true;
        })
        .then(function (hasAccess) {
            res.status(200).send(hasAccess ? '1' : '0');
        })
        .catch(function (err) {
            var error = new commonServer.CommonError('Failed to query user rights', 500, err);
            res.status(500).json(error);
        });
};
