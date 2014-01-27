module.exports = function ( env ) {
  var dbController = require( "./controller" )( env );

  return {
    user: dbController.user,
    audience: dbController.application
  };
};
