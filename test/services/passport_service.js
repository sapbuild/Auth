'use strict';
var expect = require('norman-testing-tp').chai.expect;

var commonServer = require('norman-common-server');
var TEST_TIMEOUT = 30000;

describe('Passport Service', function () {
    if (this.timeout() > 0 && this.timeout() < TEST_TIMEOUT) {
        // Do not override explicit timeout settings, e.g. through --timeout command line option when debugging
        this.timeout(TEST_TIMEOUT);
    }

    it('should be exposed through Norman registry', function () {
        var passportService = commonServer.registry.lookupModule('PassportService');
        expect(passportService).to.exist;
        expect(passportService).to.be.an('object');
    });

});
