const mongoose = require("mongoose");
function connectDb() {
  mongoose
    .connect("mongodb://127.0.0.1:27017/gapbor", {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    })
    .then(() => console.log("Mongodb is connected"))
    .catch((err) => {
      console.log(err, "mongo");
      process.exit(1);
    });
}

module.exports = {
  connectDb,
};
