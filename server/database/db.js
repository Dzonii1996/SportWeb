const { Pool } = require("pg");
const { connectionConfig } = require("./config");

const pool = new Pool(connectionConfig());

// Radnje koje čekaju kraj transakcije (npr. push obaveštenja): šalju se tek
// posle COMMIT-a, a ROLLBACK ih odbacuje. Važi za svaki client iz pool.connect(),
// bilo da transakciju vodi withTransaction ili servis sam (BEGIN/COMMIT).
const pending = new WeakMap();

const commandOf = (args) => (typeof args[0] === "string" ? args[0].trim().toUpperCase() : null);

pool.on("connect", (client) => {
  const query = client.query.bind(client);

  client.query = (...args) => {
    const command = commandOf(args);

    if (command === "BEGIN") pending.set(client, []);

    const result = query(...args);

    if ((command === "COMMIT" || command === "ROLLBACK") && pending.has(client)) {
      const callbacks = pending.get(client);
      pending.delete(client);

      if (command === "COMMIT") {
        Promise.resolve(result).then(() => callbacks.forEach((fn) => fn()), () => {});
      }
    }

    return result;
  };
});

// fn se izvršava odmah, ili posle COMMIT-a ako je db client usred transakcije
const afterCommit = (db, fn) => {
  const callbacks = pending.get(db);

  if (callbacks) callbacks.push(fn);
  else fn();
};

module.exports = pool;
module.exports.afterCommit = afterCommit;
