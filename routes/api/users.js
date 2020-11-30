const express = require('express')
const cookieParser = require('cookie-parser');
const router = express.Router();
const nodemailer = require('nodemailer')
const ejs = require('ejs')
const db = require('../../pgp');

const authJWT = require('../../authJWT')

router.use(cookieParser())


router.get('/:userID',[authJWT.verifyToken], (req, res) => {
    db.task('get-user', async t => {
        user = await db.one(`
            SELECT name, status, id
            FROM users
            where id = $1
        `, [req.params.userID])
        
        res.json({
            user: user
        })
    })
})

//Get all of a User's Connections by ID
router.get('/connections/:userID', [authJWT.verifyToken], (req, res) => {
    db
        .any(`
        Select user2 as id, u.name 
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


//Create a new connection request
router.post('/connections', [authJWT.verifyToken], (req, res) => {
    db
        .task('send-request', async t => {

            let targetUser = await db.any(`
                SELECT * from users where code = $1
            `, [req.body.friendCode])

            if (targetUser.length != 0){

                let existingFriend = await db.any(`
                    SELECT * FROM friends WHERE user1 = $2 and user2 = $1
                `, [req.body.userID, targetUser[0]["id"]]) 


                console.log("existingFriend")
                console.log(existingFriend)
    
                if (existingFriend.length == 0){

                    let existingRequest = await db.any(`
                        SELECT * FROM friend_requests WHERE user1 = $1 and user2 = $2
                    `, [req.body.userID, targetUser[0]["id"]])



                    let receivedRequest = await db.any(`
                        SELECT * FROM friend_requests WHERE user1 = $2 and user2 = $1
                    `, [req.body.userID, targetUser[0]["id"]])

                    console.log("receivedRequest")
                    console.log(receivedRequest)

                    if (receivedRequest.length == 1){
                        await db.any(`
                            DELETE FROM friend_requests WHERE user1 = $2 and user2 = $1;
                            INSERT INTO friends (user1, user2) VALUES ($1, $2);
                            INSERT INTO friends (user1, user2) VALUES ($2, $1);
                        `, [req.body.userID, targetUser[0]["id"]])
        
                        res.send("Connection Established!")

                    } else if (existingRequest.length == 0){
                        await db.any(`
                        INSERT INTO friend_requests (user1, user2, timestamp) VALUES ($1, $2, clock_timestamp())
                        `, [req.body.userID, targetUser[0]["id"]])
                        res.send("Request Sent")
    
                    } else {
                        res.send("Previous Request Pending")
                    }
                } else {
                    res.status(208)
                    res.send("Connection already established")
                }
            } else {
                res.send("User not found")
            }
        })
})


//ACCEPT FRIEND REQUEST BY USER ID

router.post('/connections/accept', [authJWT.verifyToken], (req, res) => {
    db.task('accept-friend-request', async t => {
        let request = await db.any(`
            SELECT * FROM friend_requests 
            WHERE user2 = $1 and user1 = $2
        `, [req.body.userID, req.body.userTwoID])

        if (request.length != 0){
            let acceptedRequest = await db.any(`
                DELETE FROM friend_requests WHERE user1 = $2 and user2 = $1;
                INSERT INTO friends (user1, user2) VALUES ($1, $2);
                INSERT INTO friends (user1, user2) VALUES ($2, $1);
            `, [req.body.userID, req.body.userTwoID])

            res.send("Connection established!")
        } else {
            res.send("Request not found")
        }
        
    })
})


//DECLINE FRIEND REQUEST BY USER ID

router.post('/connections/decline',[authJWT.verifyToken], (req, res) => {
    db.task('decline-friend-request', async t => {
        let request = await db.any(`
            DELETE FROM friend_requests 
            WHERE user2 = $1 and user1 = $2
        `, [req.body.userID, req.body.userTwoID])
        res.status(200).send()
    })
})


//REMOVE FRIEND BY USER ID

router.post('/connections/remove', [authJWT.verifyToken], (req, res) => {
    db.task('remove-friend', async t => {
        let checkRemoved = await db.any(`
            SELECT * FROM friends WHERE (user1 = $1 and user2 = $2) or (user1 = $2 and user2 = $1)
        `, [req.body.userID, req.body.userTwoID])

        if (checkRemoved.length != 0) {
            let removed = await db.any(`
                DELETE FROM friends 
                where (user1 = $1 and user2 = $2) or (user1 = $2 and user2 = $1)
            `, [req.body.userID, req.body.userTwoID])

            res.send("Friend Removed")
        } else {
            res.send("Friend not found")
        }
        
    })
})


// GET ALL NOTIFICATIONS BY USER ID
router.get('/notifications/:userID', [authJWT.verifyToken], (req, res) => {
    let userID = req.params.userID
    db.task('get-notifications', async t => {

        let friendRequests = await db.any(`
            Select fr.id, u.name, fr.user1, fr.user2, fr.timestamp
            from friend_requests as fr 
            join users u on u.id = fr.user1
            where fr.user2 = $1
        `, [userID])
        
        friendRequests = addNotificationType(friendRequests, `friendRequest`)
        console.log(friendRequests)

        let sessionRequests = await db.any(`
            Select psr.id, u.name, psr.user1, psr.user2, psr.timestamp
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
            where ps.user2 = $1
        `, [userID])

        peopleWarnings = addNotificationType(peopleWarnings, `peopleWarning`)
        console.log(peopleWarnings)

        let locationWarnings = await db.any(`
            Select l.name, lsw.timestamp, ls.time_start as date
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

        notifications.sort((a, b) => new Date(b.timestamp).valueOf() - new Date(a.timestamp).valueOf())

        res.status(200).json({
            notifications: notifications
        })

    })
})



//Update a user's health status
router.post('/status', [authJWT.verifyToken],  (req, res) => {
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
                    SELECT ps.id, ps.user1 as userID, ps.user2, u.name, date 
                    FROM people_sessions ps
                    JOIN users u on u.id = ps.user1
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
        let sessionID = peopleSeen[people].id
        let notifiedPerson = await db.any(`INSERT INTO people_sessions_warnings (session_id, type, timestamp) values ($1, $2, clock_timestamp()) `, [sessionID, status])
        emailWarning(peopleSeen[people], "peopleSession")
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
            SELECT ls.id, user_id, l.name, ls.date  
            FROM locations_sessions ls
            WHERE location_id = $1 
            JOIN locations l ON l.id = ls.location_id 
            AND (
                ls.time_start between $2 and $3
                ls.OR time_end between $2 and $3
            )
        `, [locationID, timeStart, timeEnd])
        for (session in notifiedVisitors){
            console.log(session)
            notifyOneVisitor(notifiedVisitors[session])
        }
    }
}


//Notifies the creator of the overlapping session
let notifyOneVisitor = async (session) => {
    let notifiedVisitor = await db.any(`INSERT INTO locations_sessions_warnings (session_id, date) values ($1, clock_timestamp()) `, [session["id"]])
    emailWarning(session, "placesSession")
} 

let emailWarning = async (session, sessionType) => {
    // TODO
    console.log("EMAIL SESSION: ")
    console.log(session)

    let user = await db.any(` SELECT email FROM users WHERE id = $1`, [session["user2"]])
    if (user.length > 0){
        console.log(user[0])
        let transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: process.env.GMAIL_USER,
                pass: process.env.GMAIL_PASSWORD
            }
        })

        let date = new Date(session["date"])

        let dateString = date.toUTCString().substr(0, 16)

        let subject = "Potential Covid-19 Exposure"

        let html;
        if (sessionType === "peopleSession"){
            html = ejs.renderFile(__dirname + '/peopleSession.ejs', {name: session["name"], dateString: dateString}, (err, data) => {
                if (err) {
                    console.log(err)
                } else {
                    console.log("PEOPLE HTML: ")
                    console.log(data)
                    return data
                }
            })
        } else {
            html = ejs.renderFile(__dirname + '/placesSession.ejs', {name: session["name"], dateString: dateString}, (err, data) => {
                if (err) {
                    console.log(err)
                } else {
                    console.log("PLACE HTML: ")
                    console.log(data)
                    return data
                }
            })
        }


        const mailOptions = {
            from: process.env.GMAIL_USER,
            to: user[0]["email"],
            subject: subject,
            html: html
        }

        transporter.sendMail(mailOptions, (error, info) => {
            if (error) {
                console.log(error)
            } else {
                console.log('Email sent: ' + info.response)
            }
        })
    }
}

let addNotificationType = (notifications, type) => {
    for (notification in notifications){
        notifications[notification].notificationType = type 
    }
    return notifications
}


module.exports = router; 