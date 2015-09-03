'use strict';

// @ngInject
module.exports = function ($rootScope, $scope, $state, $timeout, $log, Auth, httpError, uiError) {
    $scope.forms = {};
    $scope.errors = {};
    $scope.user = {};
    // We have to use an object to bind the value to the checkbox
    $scope.optOut = {
        value: false
    };

    $scope.policy = null;
    var originalUser = {};
    $scope.isAvatarChanged = false;
    $scope.optOutChanged = false;

    $scope.changeOptOut = function () {
        $scope.optOutChanged = true;
    };

    // Get the optout status of the user
    function initOptOut() {
        Auth.isOptedOut($scope.getCurrentUser().email)
            .then(function (res) {
                $scope.optOut.value = res.optOut;
            });
    }

    function initCurrentUser() {
        var currentUser = Auth.getCurrentUser();
        if (currentUser.$promise) {
            currentUser.$promise.then(function (user) {
                $scope.getCurrentUser = function () {
                    return user;
                };
                originalUser.email = user.email;
                originalUser.name = user.name;
                initOptOut();
            });
        }
        else {
            $scope.getCurrentUser = function () {
                return currentUser;
            };
            originalUser.email = currentUser.email;
            originalUser.name = currentUser.name;
            initOptOut();
        }
    }

    initCurrentUser();
    Auth.getPasswordPolicy()
        .then(function (d) {
            $scope.policy = d.policy;
        });

    $scope.$on('userAvatarChanged', function () {
        $scope.isAvatarChanged = true;
    });

    function isProfileCorrect() {
        return $scope.forms.general.name.$valid && $scope.forms.general.email.$valid;
    }

    $scope.canSave = function () {
        // If the user edited the form, the profile inputs have to be valid
        if ($scope.forms.general && $scope.forms.general.$dirty) {
            return isProfileCorrect();
        }

        // If no form elements have been edited, then the user has to update his avatar
        // in order to save something, otherwise there are no new information to save
        return $scope.isAvatarChanged;
    };

    $scope.profileUpdate = function (form) {
        $scope.profileSubmitted = true;
        if (form.name.$valid && form.email.$valid) {
            $scope.user = $scope.getCurrentUser();

            Auth.updateProfile({
                name: $scope.user.name,
                email: $scope.user.email
            })
                .then(function () {
                    originalUser.name = $scope.user.name;
                    originalUser.email = $scope.user.email;

                    form.$setPristine();
                    $scope.profileMessage = 'Profile successfully update.';
                    uiError.create({
                        content: 'Profile successfully updated.',
                        dismissOnTimeout: true,
                        dismissButton: true,
                        timeout: 5000,
                        className: 'success'
                    });
                })
                .catch(function (err) {
                    var httpErr = err;
                    $scope.errors = {};
                    if (err && err.message) {
                        $scope.errors.other = err.message;
                        $scope.formHasErrors = true;
                    }
                    else {
                        if (err) {
                            if (err.data) {
                                err = err.data;
                            }
                            if (err.error) {
                                err = err.error;
                            }
                            if (err.errors) {
                                err = err.errors;
                            }

                            // Update validity of form fields that match the mongoose errors
                            angular.forEach(err, function (error, field) {
                                if (form[field]) {
                                    form[field].$setValidity('mongoose', false);
                                }
                                $scope.errors[field] = err.name.message;
                            });
                            httpError.dismiss();
                            httpError.create({
                                req: httpErr,
                                content: 'Incorrect details.',
                                dismissOnTimeout: true,
                                dismissButton: true
                            });
                        }
                    }
                });
        }
        else {
            uiError.dismiss();
            uiError.create({
                content: 'Incorrect details.',
                dismissOnTimeout: true,
                dismissButton: true
            });
        }
    };


    $scope.errorCheck = function (password) {
        if (password.$invalid) {
            password.$setValidity('mongoose', true);
        }
    };

    $scope.changePassword = function (form) {
        $scope.submitted = true;
        if ($scope.user.newPassword !== $scope.user.confirmNewPassword) {
            form.confirmNewPassword.$setValidity('notMatch', false);
        }
        else {
			Auth.changePassword($scope.user.oldPassword, $scope.user.newPassword)
				.then(function () {
					$scope.message = 'Password successfully changed.';
					$scope.errors.other = '';
					uiError.create({
						content: 'Password successfully changed.',
						dismissOnTimeout: true,
						dismissButton: true,
						timeout: 5000,
						className: 'success'
					});
				})
				.catch(function (error) {
					$scope.message = '';
					if (error.data.errors && error.data.errors.password) {
						if (error.data.name === 'ValidationError') {
							form.newPassword.$setValidity('mongoose', false);
							form.confirmNewPassword.$setValidity('mongoose', false);
						}
						if (error.data.name === 'notAuthorized') {
							form.oldPassword.$setValidity('mongoose', false);
						}
						httpError.create({
                            req: error,
							content: error.data.errors.password.message,
							dismissOnTimeout: true,
							dismissButton: true
						});
					}
                    else {
                        httpError.create({
                            req: error,
                            content: 'Network error.',
                            dismissOnTimeout: true,
                            dismissButton: true
                        });
                    }
                });
        }
    };

	$scope.resendVerificationEmail = function () {
		Auth.resendVerificationEmail($scope.getCurrentUser().email);
	};

    $scope.isSelectedMenuItem = function (menuItem) {
        return $scope.selectedMenuItem === menuItem;
    };

    $scope.selectMenuItem = function (menuItem) {
        $scope.selectedMenuItem = menuItem;
    };

    $scope.selectMenuItem('ContactInfo');

    $scope.updateOptOut = function () {
        // Add the user to the blacklist
        if ($scope.optOut.value) {
            return Auth.optOut($scope.getCurrentUser().email);
        }

        // Remove the user from the blacklist
        return Auth.optIn($scope.getCurrentUser().email);
    };

    $scope.onDialogSave = function () {
       if (($scope.forms.general.name && $scope.forms.general.name.$dirty) || ($scope.forms.general.email && $scope.forms.general.email.$dirty)) {
           $scope.profileUpdate($scope.forms.general);
       }
       if ($scope.forms.general.oldPassword && $scope.forms.general.oldPassword.$dirty) {
            $scope.changePassword($scope.forms.general);
       }
       if ($scope.isAvatarChanged) {
            $rootScope.$broadcast('settings-save-action');
            $scope.isAvatarChanged = false;
        }
        if ($scope.optOutChanged) {
            $scope.updateOptOut();
        }
    };

    $scope.onDialogCancel = function () {
        $scope.errors = {};
        $scope.selectMenuItem('ContactInfo');
        $scope.getCurrentUser().name = originalUser.name;
        $scope.getCurrentUser().email = originalUser.email;
        $scope.user.oldPassword = '';
        $scope.user.newPassword = '';
        $scope.user.confirmNewPassword = '';
        $scope.isAvatarChanged = false;
        $scope.optOutChanged = false;
        // Set the correct optout value when the user exists the settings modal
        initOptOut();
        $scope.forms.general.$setPristine();
        $rootScope.$broadcast('settings-cancel-action');
    };
};
