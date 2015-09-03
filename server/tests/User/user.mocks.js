'use strict';
require('norman-server-tp');
var userServiceSuccess = true;

var Mocks = {

};
Mocks.setUserServiceSuccess = function (bool) {
	userServiceSuccess = bool;

};

Mocks.service = function () {
	return {
		createUser: function (newUser) {
			var deferred = Promise.defer();
			if (userServiceSuccess) deferred.resolve(newUser);
			else deferred.resolve('error');

			return deferred.promise;
		}
	};
};
Mocks.mockedJwToken = {
	sign: function () {
		return 'token';
	}
};

Mocks.model = function (user) {
	return user;
};


module.exports = Mocks;
