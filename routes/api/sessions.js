const express = require('express')
const router = express.Router();
const db = require('../../pgp');

const authJWT = require('../../authJWT')



//Get all of a users sessions from UserID
router.get('/:userID',[authJWT.verifyToken], (req, res) => {
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
        order by ls.date desc
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

//Get all of a users people sessions from UserID
router.get('/people/:userID', [authJWT.verifyToken], (req, res) => {
    db.task('get-people-sessions', async t => {
        console.log(req.params)
        const userSessions = await t.any(`
        Select u.name, date 
        from people_sessions ps
        join users u on u.id = ps.user2 
        where user1 = $1
        order by date desc
        `, [req.params.userID])
    })
    .then( (obj) => {
        console.log(obj)
        res.json({
            "Users": obj["userSessions"],
        })
    })
    .catch(err => {
        console.log(err)
    })
})

// get all of a user's location sessions by ID
router.get('/locations/:userID', [authJWT.verifyToken], (req, res) => {
    db.task('get-location-sessions', async t => {
        console.log(req.params)

        const locationSessions = await t.any(`
        Select l.name, ls.date 
        from locations_sessions ls
        join locations l on l.id = ls.location_id
        where user_id = $1
        order by ls.date desc
        `, [req.params.userID])
        return {locationSessions}

    })
    .then( (obj) => {
        console.log(obj)
        res.json({
            "Locations" : obj["locationSessions"]
        })
    })
    .catch(err => {
        console.log(err)
    })
})

//Create a new Location session for a user by userID
router.post('/locations/', [authJWT.verifyToken], (req, res) => {
    let timeInSplit = req.body.timeIn.split(":")
    let timeOutSplit = req.body.timeOut.split(":")
    let timeIn = new Date(req.body.date)
    let timeOut = new Date(req.body.date)
    timeIn.setHours(timeInSplit[0])
    timeIn.setMinutes(timeInSplit[1])
    timeOut.setHours(timeOutSplit[0])
    timeOut.setMinutes(timeOutSplit[1])
    let timeInString = `${timeIn.getUTCFullYear()}-${timeIn.getUTCMonth() + 1}-${timeIn.getUTCDate()} ${timeIn.getUTCHours()}:${timeIn.getUTCMinutes() + 1}:00`
    let timeOutString = `${timeOut.getUTCFullYear()}-${timeOut.getUTCMonth() + 1}-${timeOut.getUTCDate()} ${timeOut.getUTCHours()}:${timeOut.getUTCMinutes() + 1}:00`

    console.log("Got Location request")
    console.log(req.body.date)

    if (timeIn > timeOut){
        res.status(400).json({
            "status": "Improper time format"
        })
    } else if( checkTwoWeeks(timeIn) ) {
        res.status(400).json({
            "status": "Date must be in the past two weeks"
        })
    } else if( new Date() < timeIn ) {
        res.status(400).json({
            "status": "Date must be not be in the future"
        })
    } else {
        db
        .any(`
        INSERT INTO
        locations (id, name) 
        values ($2, $3)
        ON CONFLICT (id) DO NOTHING;   

        INSERT INTO 
        locations_sessions (user_id, location_id, date, time_start, time_end)
        values ($1, $2, $4, $5, $6);
                        

        `, [req.body.userID, req.body.locationID, req.body.locationName, req.body.date, timeInString, timeOutString])
        .then(resSql => {
            res.send("Session Created")
        })
        .catch(err => {
            console.log(err)
            res.send("Something went wrong")
        })
    }

    
})


// Create a new person session for a user by UserID
router.post('/people/', [authJWT.verifyToken], (req, res) => {
    db.task('create-people-session', async t => {
        db.any(`  
            INSERT INTO 
            people_sessions (user1, user2, date)
            values ($1, $2, $3);
                            
            INSERT INTO 
            people_sessions_requests (user1, user2, timestamp)
            values ($1, $2, clock_timestamp());

        `, [req.body.userID, req.body.userTwoID, req.body.date])
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


// Accept a session request by User IDs
router.post('/people/accept',[authJWT.verifyToken], (req, res) => {
    db.task('accept-people-session', async t => {

        let request = await db.any(`
            SELECT * FROM people_sessions_requests WHERE id = $1
        `, [req.body.sessionID])

        if (request.length != 0){ 
            let requestObject = request[0]
            if (req.body.userID == requestObject["user2"]){
                let session = await db.any(`  
                    INSERT INTO 
                    people_sessions (user1, user2, date)
                    values ($1, $2, current_date);

                    DELETE FROM people_sessions_requests 
                    WHERE id = $3
                `, [requestObject["user2"], requestObject["user1"], req.body.sessionID])
                .then(resSql => {
                    res.send("Session Added")
                })
                .catch(err => {
                    console.log(err)
                })
            } else {
                res.send("Invalid User ID")
            }
            
        } else {
            res.send("Request not found")
        }

        
    })
})

// Decline a session request by Session ID
router.post('/people/decline', [authJWT.verifyToken], (req, res) => {
    db.task('decline-people-session', async t => {
        db.any(`  
            DELETE FROM people_sessions_requests 
            WHERE ID = $1
        `, [req.body.sessionID])
        .then(resSql => {
            res.json({
                "status": "Session Declined"
            })
        })
        .catch(err => {
            console.log(err)
        })
    })
})


checkTwoWeeks = (date) => {

    let today = new Date()
    if ((today - 1209600000 > date)){
        return false
    } 
    return true
}


module.exports = router;