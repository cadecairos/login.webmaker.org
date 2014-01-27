var Sequelize = require( "sequelize" ),
    emailer = require( "../../lib/emailer" ),
    uuid = require( "uuid" ),
    forkErrorHandling,
    forkSuccessHandling,
    dbHealthCheck,
    dbErrorHandling,
    parseQuery,
    health = {
      connected: false,
      err: null
    };

// FOR MOCHA TESTING:
// If we're running as a child process, let our parent know there was a
// problem.
function forkErrorHandling() {
  if ( process.send ) {
    try {
      process.send( "sqlNoConnection" );
    } catch ( e ) {
      // exit the worker if master is gone
      process.exit(1);
    }
  }
}

// FOR MOCHA TESTING:
// If we're running as a child process, let our parent know we're ready.
function forkSuccessHandling() {
  if ( process.send ) {
    try {
      process.send( "sqlStarted" );
    } catch ( e ) {
      // exit the worker if master is gone
      process.exit(1);
    }
  }
}

// Healthcheck middleware
function dbHealthCheck( req, res, next ) {
  if ( health.connected ) {
    next();
  } else {
    next( new Error( "MySQL Error!\n", health.err ) );
  }
}

// Display a database error
function dbErrorHandling( err, callback ) {
  callback = callback || function() {};

  // Error display
  err = Array.isArray( err ) ? err[ 0 ] : err;
  console.error( "models/controller.js: DB setup error\n", err.number ? err.number : err.code, err.message );

  // Set state
  health.connected = false;
  health.err = err;

  callback();
}

function userCallback( err, user, callback ) {
  if ( err ) {
    return callback( err, null );
  }

  if ( user ) {
    return callback( null, user );
  }

  return callback();
}

// Exports
module.exports = function( env ) {
  /**
   * ENV parsing
   */
  var db,
      dbOptions = {};

  // DB Config parsing
  db = env.get("DB");
  dbOptions = env.get("DBOPTIONS");

  /**
   * Model preparation
   */
  var sequelize,
      user;

  // Connect to mysql
  try {
    sequelize = new Sequelize( db.database, db.username, db.password, dbOptions );
  } catch ( error ) {
    dbErrorHandling( error, forkErrorHandling );

    return {
      dbHealthCheck: dbHealthCheck
    };
  }

  // Connect to tables, confirm health
  user = sequelize.import( __dirname + "/userModel.js" );
  application = sequelize.import( __dirname + "/applicationModel.js" );

  sequelize.sync().complete(function( err ) {
    if ( err ) {
      dbErrorHandling( err, forkErrorHandling );
    } else {
      health.connected = true;
      forkSuccessHandling();
    }
  });

  /**
   * Model Access methods
   */
  return {
    user: {
      /**
       * getUserById( id, callback )
       * -
       * id: _id
       * callback: function( err, user )
       */
      getUserById: function( id, callback ) {
        user.find({ where: { id: id } }).complete(function( err, user ) {
          userCallback( err, user, callback );
        });
      },

      /**
       * getUserByUsername( username, callback )
       * -
       * username: username
       * callback: function( err, user )
       */
      getUserByUsername: function( username, callback ) {
        user.find({ where: { username: username } }).complete(function( err, user ) {
          userCallback( err, user, callback );
        });
      },

      /**
       * getUserByEmail( email, callback )
       * -
       * email: email
       * callback: function( err, user )
       */
      getUserByEmail: function( email, callback ) {
        user.find({ where: { email: email } }).complete(function( err, user ) {
          userCallback( err, user, callback );
        });
      },
      /**
       * createUser( data, callback )
       * -
       * data: JSON object containing user fields
       * callback: function( err, thisUser )
       */
      createUser: function( data, callback ) {
        var newUser,
            err;

        if ( !data ) {
          return callback( "No data passed!" );
        }

        if ( !data.username ) {
          return callback( "No username passed!" );
        }

        if ( !data.email ) {
          return callback( "No email passed!" );
        }

        newUser = user.build({
          email: data.email,
          fullName: data.username,
          username: data.username.toLowerCase(),
          lastLoggedIn: new Date()
        });

        // Validate
        err = newUser.validate();
        if ( err ) {
          return callback( err );
        }

        // Delegates all server-side validation to sequelize during this step
        newUser.save().complete(function( sqlErr, user ) {
          if ( sqlErr ) {
            return callback( sqlErr );
          }

          emailer.sendWelcomeEmail({
            to: user.email,
            fullName: user.fullName
          }, function( emailErr, msg ) {
            if ( emailErr ) {
              // non-fatal error
              console.error( emailErr );
            }
            if ( msg ) {
              console.log( "Sent welcome email with id %s", msg.MessageId) ;
            }

            callback( null, user );
          });
        });
      },

      /**
       * updateUser( email, data, callback )
       * -
       * email: email address
       * data: JSON object containing user fields
       * callback: function( err, user )
       */
      updateUser: function ( email, data, callback ) {
        this.getUserByEmail( email, function( err, aUser ) {
          var error;

          if ( err ) {
            return callback( err );
          }

          if ( !aUser  ) {
            return callback( "User not found!" );
          }

          // Selectively update the user model
          Object.keys( data ).forEach( function ( key ) {
            aUser[ key ] = data[ key ];
          });

          error = aUser.validate();
          if ( error ) {
            return callback( error );
          }

          aUser.save().complete( callback );
        });
      },

      /**
       * deleteUser( email, callback )
       * -
       * email: email address
       * callback: function( err, thisUser )
       */
      deleteUser: function ( email, callback ) {
        this.getUserByEmail( email, function( err, user ) {
          var error;

          if ( err ) {
            return callback( err );
          }

          if ( !user  ) {
            return callback( "User not found!" );
          }

          user.destroy().complete( callback );
        });
      },

      /**
       * getAllWithEmails( emails, callback )
       * -
       * emails: Array of Emails
       * callback: function( err, users )
       */
      getAllWithEmails: function( emails, callback ) {
        user.findAll({
          where: { "email": emails }
        }).complete( callback );
      }
    },
    application: {
      /**
       * getApp( audience, callback )
       * -
       * audience: String representing the application's audience
       * callback: function( err, values )
       */
      getApp: function( audience, callback ) {
        application.find({
          audience: audience
        }, function( err, app ) {
          if ( err || !app ) {
            return callback( err || { err: "No app found" } );
          }
          return callback( null, app.getValues() );
        });
      },

      createApp: function( data, callback ) {
        var newApp;

        if ( !data ) {
          return callback( "no data supplied" );
        }
        if ( !data.audience ) {
          return callback( "no audience supplied" );
        }

        newApp = application.build({
          audience: data.audience,
          secret: uuid.v4()
        });

        newApp.save().complete(function( err, app ) {
          if ( err ) {
            return callback( "Error saving: " + JSON.stringigy( err ) );
          }
          callback( null, app );
        });
      }
    },
    health: health
  };
};
