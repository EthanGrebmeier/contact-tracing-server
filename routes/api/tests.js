const express = require('express')
const router = express.Router();
const db = require('../../pgp');

router.post('/', (req, res) => {
    let sent = false
    if (req.body.status !== "positive" && req.body.status != "negative"){
        res.json({
            "message" : "Improperly formatted status"
        })
        sent = true;
    } else {
        db.task('get-user', async t => {
            user = await db.one(`
                select * from users where id = $1
            `, [req.body.userID])
            console.log(user)
        }).catch( (err) => {
            console.log(err)
            res.json({
                "message" : "User not found"
            })
            sent = true;
        })
        .then(() => {
            if (!sent){
                // CHANGE DATE TO A BODY PARAM
                db
                    .any(`
                    INSERT INTO
                    test_results (user_id, date, status) 
                    values ($1, current_date, $2)
                    `, [req.body.userID, req.body.status])
                    .then( (obj) => {
                        res.json({
                            "message": `${req.body.status} test results submitted`
                        })
                    })
                    .catch(err => {
                        console.log(err)
                    })
                
            }
        })
    }  
})

module.exports = router;