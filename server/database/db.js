const { Pool } = require("pg");
const { connectionConfig } = require("./config");

const pool = new Pool(connectionConfig());

module.exports = pool;
