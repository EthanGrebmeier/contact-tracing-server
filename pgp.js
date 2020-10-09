const pgp = require('pg-promise')({
    connect(client, dc, useCount) {
        console.log('Connected to Database')
    },
});

const db = pgp({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized:false,
    },
})

module.exports = db