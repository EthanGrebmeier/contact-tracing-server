const express = require('express')
const router = express.Router();
const db = require('../../pgp');

//Get all of a users sessions from UserID
router.get('/:userID', (req, res) => {
    db.task('get-sessions', async t => {
        console.log(req.params)
        const userSessions = await t.any(`
        Select u.name, date 
        from people_sessions ps
        join users u on u.id = ps.user2 
        where user1 = $1
        order by date desc
        `, [req.params.userID])

        const locationSessions = await t.any(`
        Select l.name, ls.date 
        from locations_sessions ls
        join locations l on l.id = ls.location_id
        where user_id = $1
        `, [req.params.userID])
        return {userSessions, locationSessions}

    })
    .then( (obj) => {
        console.log(obj)
        res.json({
            "Users": obj["userSessions"],
            "Locations" : obj["locationSessions"]
        })
    })
    .catch(err => {
        console.log(err)
    })
})

//Create a new Location session for a user by userID
router.post('/locations/', (req, res) => {
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
router.post('/people/', (req, res) => {
    db.task('create-people-session', async t => {
        db.any(`  
            INSERT INTO 
            people_sessions (user1, user2, date)
            values ($1, $2, current_date);
                            
            INSERT INTO 
            people_sessions_requests (user1, user2, timestamp)
            values ($1, $2, clock_timestamp());

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
    
})


module.exports = router;