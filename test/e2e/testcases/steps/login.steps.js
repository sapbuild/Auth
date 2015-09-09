'use strict';
var Auth = require('../../pageobjects/auth.po.js');
var chai = require('norman-testing-tp').chai;
var chaiAsPromised = require('norman-testing-tp')['chai-as-promised'];
var Chance = require('norman-testing-tp').chance;
var chance = new Chance();

var localbaseURL = browser.baseUrl;

chai.use(chaiAsPromised);

var expect = chai.expect;
var authPage;
var utility = require('../../support/utility.js');

// ToDo: really should use the cucumber Word Constructor to pass a user.
var user = { // Creates 1st user to be used in the login feature file.
    email: chance.email(),
    name: chance.first() + ' ' + chance.last(),
    password: 'Password1'
};

var profile = {// Creates 1st user to be used in the login feature file.
    email: chance.email(),
    name: chance.first() + ' ' + chance.last(),
    password: 'Password1'
};

var dataModeler = { // Creates 2nd user details for the signup feature file.
    email: chance.email(),
    name: chance.first() + ' ' + chance.last(),
    password: 'Password1'
};

var composerUser = { // Creates composer user.
    email: chance.email(),
    name: chance.first() + ' ' + chance.last(),
    password: 'Password1'
};

var partipant1 = { // Creates composer user.
    email: chance.email(),
    name: chance.first() + ' ' + chance.last(),
    password: 'Password1'
};

var partipant2 = { // Creates composer user.
    email: chance.email(),
    name: chance.first() + ' ' + chance.last(),
    password: 'Password1'
};


module.exports = function () {

    this.Before('@delay', function (scenario, callback) {
        setTimeout(
            function () {
                console.log('Delay for the server to start');
                callback();
            }, 15000);
    });

    this.Before('@createParticipant1', function (scenario, callback) {
        var url = localbaseURL + '/auth/signup';
        utility.post(url, partipant1).then(function (/*message*/) {
            callback();
        });
    });

    this.Before('@createParticipant2', function (scenario, callback) {
        var url = localbaseURL + '/auth/signup';
        utility.post(url, partipant2).then(function (/*message*/) {
            callback();
        });
    });


    this.Before('@createDataModelerUser', function (scenario, callback) {
        var url = localbaseURL + '/auth/signup';
        utility.post(url, dataModeler).then(function (/*message*/) {
            callback();
        });
    });

    this.Before('@createUser', function (scenario, callback) {
        var url = localbaseURL + '/auth/signup';
        utility.post(url, user).then(function (/*message*/) {
            callback();
        });
    });

    this.Before('@createProfileUser', function (scenario, callback) {
        var url = localbaseURL + '/auth/signup';
        utility.post(url, profile).then(function (/*message*/) {
            callback();
        });
    });

    this.Before('@createComposerUser', function (scenario, callback) {
        var url = localbaseURL + '/auth/signup';
        utility.post(url, composerUser).then(function (/*message*/) {
            callback();
        });
    });

    this.Given(/^I am on the login page$/, function (callback) {
        authPage = new Auth(localbaseURL + '/login');
        browser.waitForAngular();
        callback();
    });

    this.When(/^I Click Forgot Password$/, function (callback) {
        browser.waitForAngular();
        authPage.clickForgotPass();
        browser.waitForAngular();
        callback();
    });

    this.When(/^I Enter my Email$/, function (callback) {
        authPage.enterEmail(user.email);
        browser.waitForAngular();
        callback();
    });

    this.Given(/^I have logged in$/, function (callback) {
        authPage = new Auth(localbaseURL + '/login').login(user.email, user.password);
        browser.waitForAngular();
        callback();
    });

    this.When(/^Click Reset Password$/, function (callback) {
        browser.waitForAngular();
        authPage.clickResetPwd();
        browser.waitForAngular();
        callback();
    });

    this.When(/^I enter valid credentials$/, function (callback) {
        authPage.login(user.email, user.password);
        browser.waitForAngular();
        callback();
    });

    this.When(/^I enter valid old style credentials$/, function (callback) {
        authPage.oldLoginModel(user.email, user.password);
        browser.waitForAngular();
        callback();
    });

    this.When(/^I enter 2nd User credentials$/, function (callback) {
        authPage.login(profile.email, profile.password);
        browser.waitForAngular();
        callback();
    });

    this.When(/^I enter Data Modeler User credentials$/, function (callback) {
        authPage.login(dataModeler.email, dataModeler.password);
        browser.waitForAngular();
        callback();
    });

    this.When(/^I enter Participant 1 User credentials$/, function (callback) {
        authPage.login(partipant1.email, partipant1.password);
        browser.waitForAngular();
        callback();
    });

    this.When(/^I enter Participant 2 User credentials$/, function (callback) {
        authPage.login(partipant2.email, partipant2.password);
        browser.waitForAngular();
        callback();
    });

    this.When(/^I enter Data Modeler User credentials$/, function (callback) {
        authPage.login(dataModeler.email, dataModeler.password);
        browser.waitForAngular();
        callback();
    });

    this.When(/^I enter Composer User credentials$/, function (callback) {
        authPage.login(composerUser.email, composerUser.password);
        browser.waitForAngular();
        callback();
    });

    this.When(/^I enter valid email address and invalid password$/, function (callback) {
        authPage.login(user.email, 'Invalid123!!');
        browser.waitForAngular();
        callback();
    });


    this.When(/^I enter email address: "([^"]*)", password: "([^"]*)"$/, function (email, password, callback) {
        authPage.login(email, password);
        browser.waitForAngular();
        callback();
    });

    this.When(/^I enter an email address: "([^"]*)"$/, function (email, callback) {
        authPage.enterEmail(email);
        browser.waitForAngular();
        callback();
    });

    this.When(/^I enter a password: "([^"]*)"$/, function (password, callback) {
        authPage.enterPassword(password);
        browser.waitForAngular();
        callback();
    });

    this.When(/^I click on log in$/, function (callback) {
        browser.waitForAngular();
        authPage.clickLogin();
        browser.waitForAngular();
        callback();
    });

    this.Then(/^I am logged in$/, function (callback) {
        expect(browser.getTitle()).to.eventually.equal('BUILD').and.notify(callback);
        browser.driver.wait(function () {
            return browser.driver.getCurrentUrl().then(function (url) {
                return /norman/.test(url);
            });
        });
    });

    this.Then(/^I should see an error message$/, function (callback) {
        expect(authPage.lblError.getText()).to.eventually.equal('The email or password you entered is incorrect. Please try again.').and.notify(callback);
    });

    this.Then(/^I should see a tooltip beside email address$/, function (callback) {
        expect(authPage.toolTipEmailAddress('1').getText()).to.eventually.equal('This is required').and.notify(callback);
    });

    this.Then(/^I should see a tooltip beside password$/, function (callback) {
        expect(authPage.toolTipPassword.getText()).to.eventually.equal('This is required').and.notify(callback);
    });

    this.Then(/^I get warning tooltips$/, function (callback) {
        expect(authPage.toolTipPassword.isEnabled()).to.eventually.equal(true).and.notify(callback);
    });

    this.Then(/^I see the Reset Password Confirmation Label$/, function (callback) {
        expect(authPage.msgRestPwd.getText()).to.eventually.equal('An Email has been sent with password reset instructions').and.notify(callback);
    });


};