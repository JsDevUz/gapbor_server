const jwt = require("jsonwebtoken");
require("dotenv").config();

const decodeJWT = async (token) => {
  let decoded = await jwt.verify(
    token,
    process.env.ACCESS_TOKEN_SECRET,
    function (err, decoded) {
      if (err && err.name == "TokenExpiredError") {
        return false;
      }
      return decoded;
    }
  );
  return decoded;
};
module.exports = {
  decodeJWT,
};
