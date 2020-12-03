const express = require('express'); 
const cookieParser = require('cookie-parser');
const bodyParser = require('body-parser');
const cors = require('cors');
var enforce = require('express-sslify');
var sslRedirect = require('heroku-ssl-redirect');
const path = __dirname + '/views/';

const app = express(); 

app.use(express.static(path));
app.use(enforce.HTTPS({trustProtoHeader: true}));
app.use(sslRedirect());
const port = process.env.PORT || 5000

// Parse incoming requests data 
app.use(bodyParser.json()); 
app.use(bodyParser.urlencoded({ extended: false })); 

let whitelist = ['http://localhost:5000', 'https://traace.io', 'https://www.traace.io']

app.use(cors({
  origin: function(origin, callback){
    // allow requests with no origin 
    if(!origin) return callback(null, true);
    if(whitelist.indexOf(origin) === -1){
      var message = "The CORS policy for this origin doesn't allow access from the particular origin.";
      return callback(new Error(message), false);
    }
    return callback(null, true);
  },
  credentials: true
}));

app.use(cookieParser())

app.get('/', function (req,res) {
  res.sendFile(path + "index.html");
});

app.use('/api/authenticate', require('./routes/api/authenticate'))

app.use('/api/users', require('./routes/api/users'))
app.use('/api/sessions', require('./routes/api/sessions'))

const server = app.listen(port, () => {
    console.log(`Server running at Port: ${port}`);
}); 


