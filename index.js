const http = require('http'); 
const express = require('express'); 
const bodyParser = require('body-parser')
const cors = require('cors')
const app = express() // setup express application 

const port = process.env.PORT || 3000

app.use(cors)

// Parse incoming requests data 
app.use(bodyParser.json()); 
app.use(bodyParser.urlencoded({ extended: false })); 

app.use('/api/users', require('./routes/api/users'))
app.use('/api/sessions', require('./routes/api/sessions'))
app.use('/api/tests', require('./routes/api/tests'))


const server = app.listen(port, () => {
    console.log(`Server running at Port: ${port}/`);
}); 


