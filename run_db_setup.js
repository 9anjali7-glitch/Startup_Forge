const setupDatabase = require('./backend/db_setup');

const res = {
  send: (msg) => console.log(msg),
  status: (code) => ({
    send: (msg) => {
      console.error('HTTP', code, msg);
      process.exit(1);
    }
  })
};

setupDatabase(res);
