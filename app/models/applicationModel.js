module.exports = function( sequelize, DataTypes ) {
  return sequelize.define( "Application", {
    audience: {
      type: DataTypes.STRING,
      primaryKey: true
    },
    secret: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true
    }
  }, {
    charset: 'utf8',
    collate: 'utf8_general_ci',
    instanceMethods: {
      getValues: function() {
        var obj = this.values;
        return {
          audience: obj.audience,
          secret: obj.secret
        };
      }
    }
  });
};

