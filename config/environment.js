module.exports = (function() {
  var habitat = require( "habitat" );
  habitat.load(".env");
  return new habitat();
}());
