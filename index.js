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


//Get all Users
app.get('/users', (req, res) => {
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


//Get all of a User's Connections by ID
app.get('/:userID/connections', (req, res) => {
    db
        .any(`
        Select user2, u.name 
        from friends f
        join users u on u.id = f.user2 
        where user1 = $1

        `, [req.params.userID])
        .then(resSql => {
            res.json({
                "connections": resSql
            })
        })
        .catch(err => {
            console.log(err)
        })
})


//Create a new Location session for a user by userID
app.post('/sessions/locations/', (req, res) => {
    db
        .any(`
        INSERT INTO
        locations (id, name) 
        values ($2, $3)
        ON CONFLICT (id) DO NOTHING;   

        INSERT INTO 
        locations_sessions (user_id, location_id, date, time_start, time_end)
        values ($1, $2, current_date, clock_timestamp(), clock_timestamp());
                        

        `, [req.body.userID, req.body.locationID, req.body.locationName])
        .then(resSql => {
            res.json({
                "status": "Session Created"
            })
        })
        .catch(err => {
            console.log(err)
        })
})


// Create a new person session for a user by UserID
app.post('/sessions/people/', (req, res) => {
    db
        .any(`  
        INSERT INTO 
        people_sessions (user1, user2, date)
        values ($1, $2, current_date);
                        
        INSERT INTO 
        people_sessions (user1, user2, date)
        values ($2, $1, current_date);

        `, [req.body.userOneID, req.body.userTwoID])
        .then(resSql => {
            res.json({
                "status": "Session Created"
            })
        })
        .catch(err => {
            console.log(err)
        })
})



//Get all of a users sessions from UserID
app.get('/sessions/', (req, res) => {
    db.task('get-sessions', async t => {
        const userSessions = await t.any(`
        Select u.name 
        from people_sessions ps
        join users u on u.id = ps.user2 
        where user1 = $1
        `, [req.body.userID])

        const locationSessions = await t.any(`
        Select l.name, ls.date 
        from locations_sessions ls
        join locations l on l.id = ls.location_id
        where user_id = $1
        `, [req.body.userID])
        return {userSessions, locationSessions}

    })
    .then( (obj) => {
        res.json({
            "Users": obj["userSessions"],
            "Locations" : obj["locationSessions"]
        })
    })
    .catch(err => {
        console.log(err)
    })
})


server.listen(port, () => { console.log(`Server running at Port: ${port}/`); });