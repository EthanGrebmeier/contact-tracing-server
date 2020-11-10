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
router.get('/people/:userID', (req, res) => {
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
router.get('/locations/:userID', (req, res) => {
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
router.post('/locations/', (req, res) => {
    let timeInSplit = req.body.timeIn.split(":")
    let timeOutSplit = req.body.timeOut.split(":")
    let timeIn = new Date(req.body.date)
    let timeOut = new Date(req.body.date)
    timeIn.setHours(timeInSplit[0])
    timeIn.setMinutes(timeInSplit[1])
    timeOut.setHours(timeOutSplit[0])
    timeOut.setMinutes(timeOutSplit[1])
    let timeInString = `${timeIn.getFullYear()}-${timeIn.getMonth() + 1}-${timeIn.getDate()} ${timeIn.getHours()}:${timeIn.getMinutes() + 1}:00`
    let timeOutString = `${timeOut.getFullYear()}-${timeOut.getMonth() + 1}-${timeOut.getDate()} ${timeOut.getHours()}:${timeOut.getMinutes() + 1}:00`

    console.log("Got Location request")

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
            res.json({
                "status": "Session Created"
            })
        })
        .catch(err => {
            console.log(err)
        })
    }

    
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

checkTwoWeeks = (date) => {

    let today = new Date()
    if ((today - 1209600000 < date)){
        return false
    } 
    return true
}


module.exports = router;