const express = require('express')
const router = express.Router()

const bcrypt = require('bcryptjs')

const db = require('../../pgp');

router.post('/register', (req, res) => {
  db.task('register-user', async t => {

    let email = req.body.email
    let password = req.body.password
    let firstName = req.body.firstName
    let lastName = req.body.lastName

    if (email && password && firstName && lastName) {

      let user = await db.any(`
        SELECT * FROM USERS 
        WHERE email = $1
      `, [req.body.email])

      console.log(user)

      if (!checkSignUpForm(firstName, lastName, email, password)){
        res.status(400).send("Invalid Request")
      } else if(user.length != 0){
        res.status(400).send("Email in use")
      } else {
        bcrypt.genSalt(10, function(err, salt) {
          bcrypt.hash(password, salt, async function(err, hash){

            if (err) console.log(err)

            let fullName = `${firstName} ${lastName}`

            email = email.toLowerCase()

            let friendCode = Math.floor(Math.random() * 1000000000).toString();
            console.log(`Friend Code: ${friendCode}`)
            let checkID = await db.any(`
              SELECT * FROM USERS WHERE code = $1
            `, [friendCode])

            while (checkID.length != 0){
              let friendCode = Math.floor(Math.random() * 1000000000).toString();
              let checkID = await db.any(`
                SELECT * FROM USERS WHERE code = $1
              `, [friendCode])
            }
      
            let createUser = await db.any(`
              INSERT INTO USERS 
              (name, code, created_at, status, email, password)
              VALUES ($1, $2, clock_timestamp(), 'healthy', $3, $4)
            `, [fullName, friendCode, email, hash])

            let newUser = await db.any(`
              SELECT id FROM users WHERE code = $1
            `, [friendCode])

            console.log(newUser)

            res.json({
              id: newUser[0]
            })
          })
        })
      }
    } else {
      res.status(400).send("Invalid Request")
    }
    
    
  })
})


router.post('/login', (req, res) => {
  console.log(req.body)
  let password = req.body.password
  let email = req.body.email
  if (password && email){
    email = email.toLowerCase()
    db.task('log-in', async t => {
      let user = await db.any(`
        SELECT * from users where email = $1
      `, [email])
      if (user.length == 0){
        res.send("Email Not Found")
      } else {
        console.log(user)
        bcrypt.compare(password, user[0]["password"], function(err, status){
          if (status) {
            res.json({
              userID: user[0]["id"]
            })
          } else {
            res.send("Invalid Password")
          }
        })
        
      }
    })
  } else {
    res.status(200).send("Invalid Request")
  }
  
})

var emailRegex = /^[-!#$%&'*+\/0-9=?A-Z^_a-z{|}~](\.?[-!#$%&'*+\/0-9=?A-Z^_a-z`{|}~])*@[a-zA-Z0-9](-*\.?[a-zA-Z0-9])*\.[a-zA-Z](-?[a-zA-Z0-9])+$/;

function isEmailValid(email) {
  console.log(email)
    if (!email)
        return false;

    if(email.length>254)
        return false;

    var valid = emailRegex.test(email);
    if(!valid)
        return false;

    // Further checking of some things regex can't handle
    var parts = email.split("@");
    if(parts[0].length>64)
        return false;

    var domainParts = parts[1].split(".");
    if(domainParts.some(function(part) { return part.length>63; }))
        return false;

    return true;
}

function checkForCapital(password){
  for (let i = 0; i < password.length; i++){
      let charCode = password.charCodeAt(i)
      if (charCode > 64 && charCode < 90){
          return true
      }
  }
  return false
}

function checkForNumber(password){
  for (let i = 0; i < password.length; i++){
      let charCode = password.charCodeAt(i)
      if (charCode > 47 && charCode < 58){
          return true
      }
  }
  return false
}

function checkSignUpForm(firstName, lastName, email, password, confirmPassword){
  event.preventDefault()
  if (firstName === "" ){
    return false
  } else if (lastName === ""){
    return false
  } else if (email === ""){
    return false
  } else if (password === ""){
    return false
  } else if (!isEmailValid(email)){
    return false
  } else if (password.length < 7){
    return false
  } else if (!checkForCapital(password)){
    return false
  } else if (!checkForNumber(password)){
    return false
  } 
  return true
}

module.exports = router;