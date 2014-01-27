var jwt = require("jsonwebtoken"),
    verify = require("browserid-verify")(),
    expressJWT = require("express-jwt");

module.exports = function( env, appModel ) {

  return {
    token: function(req, res) {
      var audience = req.body.audience,
          assertion = rew.body.assertion;

    }

  };
};
