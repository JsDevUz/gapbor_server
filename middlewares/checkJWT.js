const jwt = require("jsonwebtoken");
require("dotenv").config();

const verifyJWT = (req, res, next) => {
  const authHeader = req.headers.authorization || req.headers.Authorization;
  if (!authHeader?.startsWith("Bearer "))
    res.status(401).send({ message: "Amal bajarish huquqi yo'q #7" });
  const token = authHeader.split(" ")[1];
  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
    if (err) return res.sendStatus(403); //invalid token
    req.email = decoded.email;
    req.roles = decoded.roles;
    req.userId = decoded.userId;
    next();
  });
};

module.exports = verifyJWT;
