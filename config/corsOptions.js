const allowedOrigins = require("./allowedOrigins");

const corsOptions = {
  origin: (origin, callBack) => {
    if (allowedOrigins.indexOf(origin) !== -1 || !origin) {
      callBack(null, true);
    } else {
      callBack(new Error("Not allowed by CORS"));
    }
  },
  optionsSuccessStatus: 200,
};

module.exports = corsOptions;
