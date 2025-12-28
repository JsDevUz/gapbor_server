// const mongoose = require("mongoose");
// function connectDb() {
//   mongoose
//     .connect("mongodb://127.0.0.1:27017/gapbor", {
//       useNewUrlParser: true,
//       useUnifiedTopology: true,
//     })
//     .then(() => console.log("Mongodb is connected"))
//     .catch((err) => {
//       console.log(err, "mongo");
//       process.exit(1);
//     });
// }

// module.exports = {
//   connectDb,
// };
const mongoose = require("mongoose");
function connectDb() {
  mongoose
// MONGO_URI=

    .connect("mongodb+srv://jsdev:n6WNUpCcxdJJBKlO@cluster0.laasihv.mongodb.net/gapbor?retryWrites=true&w=majority", {
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
