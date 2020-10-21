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



module.exports = router; 