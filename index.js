const http = require('http'); 
const express = require('express'); 
const bodyParser = require('body-parser')
const pgp = require('pg-promise')({

    connect(client, dc, useCount) {
        console.log('Connected to Database')
    }
});


const db = pgp(process.env.DATABASE_URL)

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
    let data; 
    db
        .any(query)
        .then(resSql => {
            console.log(resSql);
            data = resSql["rows"]
            res.json({
                "users": data
            })
        })
        .catch(err => {
            console.log(err)
        })
    
})


server.listen(port, () => { console.log(`Server running at Port: ${port}/`); });