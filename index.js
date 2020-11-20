const http = require('http'); 
const express = require('express'); 


const cookieParser = require('cookie-parser');
const bodyParser = require('body-parser');
const cors = require('cors');
const app = express(); 

const db = require('./pgp');

const port = process.env.PORT || 5000


// Parse incoming requests data 
app.use(bodyParser.json()); 
app.use(bodyParser.urlencoded({ extended: false })); 
app.use(cors({
    origin: "http://localhost:3000",
    credentials: true
}))



app.use('/api/authenticate', require('./routes/api/authenticate'))

app.use('/api/users', require('./routes/api/users'))
app.use('/api/sessions', require('./routes/api/sessions'))

const server = app.listen(port, () => {
    console.log(`Server running at Port: ${port}`);
}); 


