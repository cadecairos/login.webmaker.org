var assert = require("assert"),
  sinon = require("sinon"),
  mocha = require("mocha"),
  Sequelize = require('sequelize'),
  login3 = require("../app/http/controllers/user3");

var appURL = "https://webmaker.org/";

var testUser = {
  id: 1,
  email: "webmaker@example.com",
  username: "webmaker",
  verified: true
};

var fakeUser = {
  id: 2,
  email: "faker@example.com",
  username: "faker",
  verified: false
};

testUser.getDataValue = (function(key) {
  return this[key];
}).bind(testUser);

fakeUser.getDataValue = (function(key) {
  return this[key];
}).bind(fakeUser);

describe("Login V3", function() { with(this) {
  before(function(done) { with(this) {
    var sequelize = this.sequelize = new Sequelize("wmlogin-test", "", "", {
      dialect: "sqlite",
      storage: "logintesting.sqlite"
    });

    var modelControllers = this.modelControllers = require('../app/db/models')(sequelize);

    sequelize.dropAllSchemas()
      .complete(function (err) {
        assert.ifError(err);
        sequelize.sync()
          .complete(function(err) {
            assert.ifError(err);
            modelControllers.createUser(testUser, function(err) {
              assert.ifError(err);
              done();
            });
          });
      });
  }});

  after(function(resume) { with(this) {
    this.sequelize.dropAllSchemas().complete(function() {
      resume();
    });
  }});

  describe("generateLoginTokenForUser", function() { with(this) {
    before(function() { with(this) {
      this.spy = sinon.spy(this.modelControllers, "createToken");
      this.generateToken = login3.generateLoginTokenForUser(this.modelControllers);
    }});

    after(function() { with(this) {
      this.modelControllers.createToken.restore();
    }});

    it("creates a token", function(done) { with(this) {
      spy = this.spy;
      this.generateToken({
        body: {
          appURL: appURL
        }
      }, {
        json: function(code, result) {
          assert.equal(code, 200);
          assert(result);
          assert.equal(result.status, "Login Token Sent");
          assert(spy.calledWith(testUser, appURL));
          done();
        },
        locals: {
          user: testUser
        }
      });
    }});
  }});

  describe("verifyTokenForUser", function() { with(this) {
    before(function(done) { with(this) {
      var that = this;
      this.verifyToken = login3.verifyTokenForUser(this.modelControllers);
      this.modelControllers.createToken(testUser, appURL, function(err, token) {
        assert.ifError(err);
        that.token = token;
        done();
      });
    }});

    after(function() { with(this) {
      this.modelControllers.lookupToken.restore();
    }});

    it("verifies the token", function(done) { with(this) {
      var lookupTokenSpy = sinon.spy(this.modelControllers, "lookupToken"),
        jsonSpy = sinon.spy(),
        that = this;

      this.verifyToken({
        body: {
          token: this.token
        }
      }, {
        json: jsonSpy,
        locals: {
          user: testUser
        }
      }, function() {
        assert(!jsonSpy.called);
        assert(lookupTokenSpy.called && lookupTokenSpy.calledOnce);
        assert(lookupTokenSpy.calledWith(testUser, that.token));
        done();
      });
    }});
  }});
}});
