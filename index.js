const http = require('http'); 
const express = require('express'); 
const bodyParser = require('body-parser')
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

const query =  `
SELECT * FROM USERS 

`


const port = process.env.PORT || 3000

const app = express() // setup express application 

const server = http.createServer(app); 

// Parse incoming requests data 
app.use(bodyParser.json()); 
app.use(bodyParser.urlencoded({ extended: false })); 

app.get('/', (req, res) => {
    db
        .any(query)
        .then(resSql => {
            res.json({
                "users": resSql
            })
        })
        .catch(err => {
            console.log(err)
        })
    
})


server.listen(port, () => { console.log(`Server running at Port: ${port}/`); });