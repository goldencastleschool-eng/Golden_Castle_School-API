const {pool} = require('pg');

const db = new pool({
  connectionString: process.env.DATABASE_URL,

});


module.exports = db;