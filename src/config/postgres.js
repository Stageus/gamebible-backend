const { Pool } = require('pg');
require('dotenv').config();

const psqlDBconfig = {
    host: process.env.PSQL_HOST,
    port: process.env.PSQL_PORT,
    database: process.env.PSQL_DATABASE,
    user: process.env.PSQL_USER,
    password: process.env.PSQL_PW,
    idleTimeoutMillis: 10 * 1000,
    connectionTimeoutMillis: 15 * 1000,
};

const pool = new Pool(psqlDBconfig);

module.exports = {
    pool,
};