const express = require("express");

require("dotenv").config();
const app = express();
const PORT = process.env.PORT || 3001;

const db = require("./utils/dbUtils");
app.use(express.json());

//-testing endpoint-//
app.get("/", (req, res) => {
  res.send("Welcome");
});

const userRoutes = require("./route/userRoutes");
app.use("/", userRoutes);
//--//

//-global error handler-//
const error = async function (err, req, res, next) {
  if (err.status) {
    console.log(err);
    res.status(err.status).send({ Error: err.message });
  } else {
    console.log(err);
    res.status(500).send({ Error: err.message });
  }
};

app.use(error);
//--//

//-handle database connection-//
db.connectDb();
process.on("SIGINT", () => {
  console.log("Closing server");
  db.disconnectDB();
  process.exit();
});

process.on("exit", () => {
  console.log("Server closed");
});
//--//

app.listen(PORT, () => {
  console.log(`listening on port:${PORT}`);
});
