module.exports.fetchUserBy = function(name, User) {
  var fetch = User["getUserBy" + name];

  return function(req, res, next, param) {
    fetch(param, function(err, user) {
      if (err) {
        return res.json({
          "error": "Login database error",
          "login_error": err instanceof Error ? err.toString() : err
        });
      }

      if (!user) {
        return res.json({
          "error": "User with " + name + " `" + param + "` not found"
        });
      }

      res.locals.user = user;
      process.nextTick(next);
    });
  };
};

module.exports.filterUserAttributesForSession = function(req, res, next) {
  res.locals.user = res.locals.user.serializeForSession();

  process.nextTick(next);
};

module.exports.personaFilter = function(audience_whitelist) {
  return function(req, res, next) {
    if (!req.body.audience) {
      return res.json({
        "error": "Missing audience"
      });
    }

    if (audience_whitelist.indexOf(req.body.audience) === -1 &&
        audience_whitelist.indexOf("*") === -1) {
      return res.json({
        "error": "Audience parameter not allowed"
      });
    }

    if (!req.body.assertion) {
      return res.json({
        "error": "Missing assertion"
      });
    }

    process.nextTick(next);
  };
};

var verify = require( "browserid-verify" )();

module.exports.personaVerifier = function(req, res, next) {
  verify(req.body.assertion, req.body.audience, function(err, email, response) {
    if (err) {
      return res.json({
        "error": "Persona verifier error",
        "verifier_error": err instanceof Error ? err.toString() : err
      });
    }

    if (!email) {
      return res.json({
        "error": "Persona verifier error",
        "verifier_error": response
      });
    }

    res.locals.email = email;
    process.nextTick(next);
  });
};

module.exports.updateLastLoggedIn = function(User) {
  return function(req, res, next) {
    User.updateUser( res.locals.email, {
      lastLoggedIn: new Date()
    }, function( err ) {
      //TODO do something useful if this error happens
      process.nextTick(next);
    });
  };
};

module.exports.cors = function( CORS_DOMAINS ) {
  return function (req, res, next) {
    // Only 1 domain can be served up with Allow-Origin, so we'll use the incoming one if allowed
    if (CORS_DOMAINS.indexOf(req.headers.origin) > -1) {
    res.header('Access-Control-Allow-Origin', req.headers.origin);
    res.header('Access-Control-Allow-Methods', 'POST, GET, PUT');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-CSRF-Token');
    res.header('Access-Control-Allow-Credentials', true);
    }
    next();
  };
};
