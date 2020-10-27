const express = require('express')
const router = express.Router();
const db = require('../../pgp');


//Get all of a User's Connections by ID
router.get('/connections/:userID', (req, res) => {
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


//Create a new connection
router.post('/connections', (req, res) => {
    db
        .task('send-request', async t => {
            friend = await db.any(`
            SELECT * FROM friends WHERE user1 = $2 and user2 = $1
            `, [req.body.userOneID, req.body.userTwoID]) 

            if (friend == []){
                request = await db.any(`
                SELECT * FROM friend_requests WHERE user1 = $2 and user2 = $1
                `, [req.body.userOneID, req.body.userTwoID])

                if(request == []){
                    await db.any(`
                    INSERT INTO friend_requests (user1, user2) VALUES ($1, $2)
                    `, [req.body.userOneID, req.body.userTwoID])
                    res.status(201)

                } else {
                    await db.any(`
                    DELETE FROM friend_requests WHERE user1 = $2 and user2 = $1
                    `, [req.body.userOneID, req.body.userTwoID])

                    await db.any(`
                    INSERT INTO friends (user1, user2) VALUES ($1, $2)
                    `, [req.body.userOneID, req.body.userTwoID])

                    await db.any(`
                    INSERT INTO friends (user1, user2) VALUES ($2, $1)
                    `, [req.body.userOneID, req.body.userTwoID])

                    res.status(202)
                }

                name = await db.any(`
                    select name from users where id = $1
                    `, [req.body.userOneID]) 

                console.log(name)

                res.json({
                    "connection": {
                        "userName":  name["name"],
                        "userID": req.body.userOneID
                    }
                })
            } else {
                res.status(208)
                res.json({
                    "message": "Connection Already Established"
                })
            }
            

        })
})

router.get('/notifications', (req, res) => {
    let userID = req.body.userID
    db.task('get-notifications', async t => {

        let friendRequests = await db.any(`
            Select fr.id, u.name, fr.timestamp
            from friend_requests as fr 
            join users u on u.id = fr.user1
            where fr.user2 = $1
        `, [userID])
        
        friendRequests = addNotificationType(friendRequests, `friendRequest`)
        console.log(friendRequests)

        let sessionRequests = await db.any(`
            Select psr.id, u.name, psr.timestamp
            from people_sessions_requests as psr 
            join users u on u.id = psr.user1
            where psr.user2 = $1
        `, [userID])

        sessionRequests = addNotificationType(sessionRequests, `sessionRequest`)

        console.log(sessionRequests)

        let peopleWarnings = await db.any(`
            Select u.name, psw.type, psw.timestamp
            from people_sessions_warnings as psw 
            join people_sessions ps on ps.id = psw.session_id
            join users u on u.id = ps.user1
            where ps.user1 = $1
        `, [userID])

        peopleWarnings = addNotificationType(peopleWarnings, `peopleWarning`)
        console.log(peopleWarnings)

        let locationWarnings = await db.any(`
            Select l.name, lsw.timestamp
            from locations_sessions_warnings as lsw 
            join locations_sessions ls on ls.id = lsw.session_id
            join locations l on l.id = ls.location_id
            join users u on u.id = ls.user_id
            where ls.user_id = $1
        `, [userID])

        locationWarnings = addNotificationType(locationWarnings, `locationWarning`)
        console.log(locationWarnings)

        let notifications = friendRequests.concat(sessionRequests)
        notifications = notifications.concat(peopleWarnings)
        notifications = notifications.concat(locationWarnings)

        notifications.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))

        res.status(200).json({
            notifications: notifications
        })

    })
})



//Update a user's health status
router.post('/status', (req, res) => {
    let status = req.body.status
    let userID = req.body.userID
    if(status == 'healthy' || status == 'unwell' || status == 'positive'){
        db
        .task('update-status', async t => {
            user = await db.any(` UPDATE users *
            SET status = $1
            WHERE id = $2`, [status, userID])

            // Only runs on positive test or feeling unwell
            if (status == 'positive' || status == 'unwell'){
                // Checks what people the user has seen in the last two weeks
                peopleSeen = await db.any(`
                    SELECT ps.id, u.name, date 
                    FROM people_sessions ps
                    JOIN users u on u.id = ps.user2
                    WHERE user1 = $1
                `, [userID])

                // Notifies people that are recorded as having direct contact in the last two weeks
                notifyContacts(peopleSeen, status)

                if (status == 'positive'){
                    //Checks what places the user has visited in the last two weeks 
                    placesVisited = await db.any(`
                        SELECT location_id, time_start, time_end 
                        FROM locations_sessions
                        WHERE user_id = $1
                    `, [userID])

                    // Notifies people that were at the same place at the same time in the last two weeks
                    notifyVisitors(placesVisited)
                }                
            }

            res.status(200)
            res.json({status: status})

        })
    } else {
        res.status(400).end()
    }
    
})




// Notify people that are recorded as having direct contact in the last two weeks
let notifyContacts = async (peopleSeen, status) => {
    console.log("PEOPLE")
    console.log(peopleSeen)
    for(people in peopleSeen){
        id = peopleSeen[people].id
        let notifiedPerson = await db.any(`INSERT INTO people_sessions_warnings (session_id, type, timestamp) values ($1, $2, clock_timestamp()) `, [id, status])
        emailWarning()
    }
}

// Notify everyone that had an overlapping session with the sessions of the positive user
let notifyVisitors = async (places) => {
    console.log(places)
    for (place in places){
        console.log(places[place])
        let locationID = places[place].location_id 
        let timeStart = places[place].time_start
        let timeEnd = places[place].time_end
        let notifiedVisitors = await db.any(`
            SELECT user_id 
            FROM locations_sessions
            WHERE location_id = $1 
            AND (
                time_start between $2 and $3
                OR time_end between $2 and $3
            )
        `, [locationID, timeStart, timeEnd])
        for (user in notifiedVisitors){
            console.log(user.user_id)
            notifyOneVisitor(notifiedVisitors[user])
        }
    }
}


//Notifies the creator of the overlapping session
let notifyOneVisitor = async (userID) => {
    let notifiedVisitor = await db.any(`INSERT INTO locations_sessions_warnings (session_id, date) values ($1, clock_timestamp()) `, [userID])
    emailWarning()
} 

let emailWarning = () => {
    // TODO
}

let addNotificationType = (notifications, type) => {
    for (notification in notifications){
        notifications[notification].type = type 
    }
    return notifications
}


module.exports = router; 