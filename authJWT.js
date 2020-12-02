const jwt = require("jsonwebtoken");
 
const db = require("./pgp");

verifyToken = async (req, res, next) => {
  let token = req.cookies["accessToken"];

  console.log("Token")
  console.log(token)

  let id = req.body.userID || req.body.userOneID || req.params.userID

  console.log("ID")
  console.log(id)

  if (!token) {
    return res.status(403).send({
      message: "No token provided!"
    });
  }

  jwt.verify(token, process.env.TOKENSECRET, (err, decoded) => {

    console.log("DECODED ID")
    console.log(decoded["userID"])

    console.log("EXPECTED ID")
    console.log(id)

    if (err || decoded["userID"] != id) {
      if (err){
        console.log(err)
      }
      return res.status(401).send({
        message: "Unauthorized!"
      });
    }
    req.userID = decoded.userID;
    next();
  });
};


const authJwt = {
  verifyToken: verifyToken,
};
module.exports = authJwt;