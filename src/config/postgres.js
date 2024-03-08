const { Pool } = require('pg');
const env = require('./env');
const psqlDBconfig = {
    host: process.env.PSQL_HOST,
    port: process.env.PSQL_PORT,
    database: process.env.PSQL_DATABASE,
    user: process.env.PSQL_USER,
    password: process.env.PSQL_PW,
};

const pool = new Pool(psqlDBconfig);

module.exports = {
    pool,
};
