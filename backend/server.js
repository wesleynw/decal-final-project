const express = require("express");
var cors = require("cors");
const app = express();
const port = 3000;

const { header, body, validationResult } = require("express-validator");

app.use(express.json());
app.use(cors());

const mongoose = require("mongoose");
mongoose.set("strictQuery", false);

const bcrypt = require("bcrypt");
const { v4: uuidv4 } = require("uuid");

const mongoDB = "mongodb://127.0.0.1:27017/todo-backend";
var connectWithRetry = async function () {
  try {
    await mongoose.connect(mongoDB);
    console.log("successfully connected to mongodb");
  } catch (err) {
    console.error("Failed to connect to mongo on startup - retrying in 5 sec");
    setTimeout(connectWithRetry, 5000);
  }
};
connectWithRetry();

const TaskSchema = new mongoose.Schema({
  key: String,
  name: String,
  date: String,
  priority: String,
});

const UserSchema = new mongoose.Schema({
  name: String,
  email: String,
  password: String,
  token: mongoose.Schema.Types.UUID,
  todolist: [TaskSchema],
});

// Compile model from schema
const User = mongoose.model("Users", UserSchema);

app.post(
  "/create-account",
  body("name").notEmpty().trim().escape().withMessage("invalid name"),
  body("email")
    .notEmpty()
    .isEmail()
    .custom(async (value) => {
      const count = await User.find({ email: value }).countDocuments();
      if (count != 0) {
        throw new Error("username already in use");
      }
    }),
  body("password").notEmpty(),
  body("password_confirmation")
    .notEmpty()
    .custom((value, { req }) => {
      return value == req.body.password;
    })
    .withMessage("passwords do not match"),
  async function (req, res) {
    if (mongoose.connection.readyState != 1) {
      return res.status(500).send({
        errors: {
          msg: "database error",
        },
      });
    }

    const result = validationResult(req);
    if (!result.isEmpty()) {
      return res.status(422).send({ errors: result.array() });
    }

    try {
      bcrypt.hash(req.body.password, 10, async function (err, hash) {
        // Store hash in the database
        let newUser = new User({
          username: req.body.username,
          email: req.body.email,
          password: hash,
          token: uuidv4(),
          todolist: Array(0),
        });

        await newUser.validate();
        let result = await newUser.save();

        if (result != newUser) {
          throw new Error("db error");
        }

        console.log(`created user ${req.body.email}`);
        return res.status(201).send({ token: newUser.token });
      });
    } catch (err) {
      console.log(err);
      res.sendStatus(500);
    }
  }
);

app.get(
  "/login",
  body("email").notEmpty().isEmail(),
  body("password").notEmpty(),
  async function (req, res) {
    if (mongoose.connection.readyState != 1) {
      return res.status(500).send({
        errors: {
          msg: "database error",
        },
      });
    }

    const result = validationResult(req);
    if (!result.isEmpty()) {
      return res.status(422).send({ errors: result.array() });
    }

    // let user = await User.exists

    let user = await User.findOne({ email: req.body.email }).lean();
    if (user == null) {
      return res.status(422).send({ errors: "user does not exist" });
    }

    bcrypt.compare(req.body.password, user.password, function (err, result) {
      // result == true
      if (result == true) {
        return res
          .status(200)
          .send({ status: "authenticated", token: user.token });
      }
      return res
        .status(422)
        .send({ status: "not authenticated", error: "invalid password" });
    });
  }
);

app.get(
  "/get-todo",
  header("token").notEmpty().isUUID(),
  async function (req, res) {
    const result = validationResult(req);
    if (!result.isEmpty()) {
      return res.status(422).send({ errors: result.array() });
    }

    const user = await User.findOne({ token: req.headers.token }).exec();
    if (user == null) {
      return res.status(401).send({ errors: "session token invalid" });
    }
    if (user.token == req.headers.token) {
      return res.send(user.todolist);
    }
  }
);

app.post("/add-todo", body("name").notEmpty(), async function (req, res) {
  const result = validationResult(req);
  if (!result.isEmpty()) {
    return res.status(422).send({ errors: result.array() });
  }

  const user = await User.findOne({ token: req.body.token }).exec();
  if (user == null) {
    return res.status(401).send({ errors: "session token invalid" });
  }
  // is this redundant ??
  if (user.token == req.body.token) {
    let newItem = {
      key: req.body.key,
      name: req.body.name,
      date: req.body.date,
      priority: req.body.priority,
    };
    user.todolist.push(newItem);
    await user.save();

    return res.sendStatus(201);
  }
});

app.post(
  "/delete-todo",
  body("token").notEmpty().isUUID(),
  body("key").notEmpty(),
  async function (req, res) {
    const result = validationResult(req);
    if (!result.isEmpty()) {
      return res.status(422).send({ errors: result.array() });
    }

    const user = await User.findOne({ token: req.body.token }).exec();
    if (user == null) {
      return res.status(401).send({ errors: "session token invalid" });
    }

    user.todolist.pull({ key: req.body.key });
    await user.save();

    return res.sendStatus(200);
  }
);

app.listen(port, function () {
  console.log(`Example app listening on port ${port}!`);
});
