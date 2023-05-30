import express from "express";
import cors from "cors";
import mongoose from "mongoose";
import crypto from "crypto";
import bcrypt from "bcrypt";
import { error } from "console";

const mongoUrl = process.env.MONGO_URL || "mongodb://127.0.0.1:27017/project-mongo"
mongoose.connect(mongoUrl, { useNewUrlParser: true, useUnifiedTopology: true });
mongoose.Promise = Promise;

// Defines the port the app will run on. Defaults to 8080, but can be overridden
// when starting the server. Example command to overwrite PORT env variable value:
// PORT=9000 npm start
const port = process.env.PORT || 8080;
const app = express();

// Add middlewares to enable cors and json body parsing
app.use(cors());
app.use(express.json());

// Start defining your routes here
app.get("/", (req, res) => {
  res.send("Hello Fuckface!");
});


/////////////// User authentication start
// Create user
const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true
  },
  password: {
    type: String,
    required: true
  },
  accessToken: {
    type: String,
    default: () => crypto.randomBytes(128).toString("hex")
  },
  createdAt: {
    type: Date,
    default: () => new Date()
  }
});

const User = mongoose.model("User", userSchema);

// Endpoint to register
app.post("/register", async (req, res) => {
  const { username, password } = req.body;
  // Hash the password
  try {
    const salt = bcrypt.genSaltSync();
    const newUser = await new User({
      username: username,
      password: bcrypt.hashSync(password, salt)
    }).save();
    if (newUser) {
      res.status(201).json({
        success: true,
        response: {
          username: newUser.username,
          id: newUser._id,
          accessToken: newUser.accessToken,
          createdAt: newUser.createdAt
        }
      })
    } else {
      res.status(400).json({
        success: false,
        response: "Could not register user"
      })

    } 
  } catch (e) {
    res.status(400).json({
      success: false,
      message: "Could not register user",
      response: e
    })
  }
});

// Endpoint to login
app.post("/login", async (req, res) => {
  const { username, password } = req.body;
  try {
    const user = await User.findOne({ username })
    if (user && bcrypt.compareSync(password, user.password)) {
      res.status(201).json({
        success: true,
        response: {
          username: user.username,
          id: user._id,
          accessToken: user.accessToken,
          createdAt: user.createdAt
        }
      })
    } else {
      res.status(400).json({
        success: false,
        message: "Credentials do not match"
      })
    }
  } catch (e) {
    res.status(500).json({
      success: false,
      message: "Could not log in user",
      response: e
    })
  }
});

// Authenticate user
const authenticateUser = async (req, res, next) => {
  const accessToken = req.header("Authorization");
  try {
    const user = await User.findOne({accessToken})
    if (user) {
      next();
    } else {
      res.status(401).json({
        success:false,
        response: "Please log in"
      })
    }
  } catch (e) {
    res.status(500).json({
      success: false,
      message: "Could not authenticate user",
      response: e
    })
  }
};
/////////////// User authentication end

/////////////// Reviews start
// Create review

const  reviewSchema = new mongoose.Schema({
  message: {
    type: String
  },
  createdAt: {
    type: Date,
    default: () => new Date()
  },
  //hearts: {
    //type: Number,
    //default: 0
  //},
  user: {
    type: String,
    required: true
  }
});

const Review = mongoose.model("Review", reviewSchema);

// Endpoint to post new review (when logged in)

app.post("/reviews", authenticateUser);
app.post("/reviews", async (req, res) => {
  const { message } = req.body;
  const accessToken = req.header("Authorization");
  const user = await User.findOne({accessToken})
  const reviews = await new Review({message: message, user: user._id}).save()
  // try catch, if else
  try {
    if (reviews) {
      res.status(200).json({
        success: true, 
        response: reviews})
    } else {
      res.status(400).json({
        success: false, 
        response: "Please log in to POST review"})
    }
  } catch(e) {
    res.status(500).json({
      success: false,
      response: e
    })
  }
});

// Endpoint to find all reviews by one specific user (when logged in)

app.get("/reviews", authenticateUser);
app.get("/reviews", async (req, res) => {
  const accessToken = req.header("Authorization");
  const user = await User.findOne({accessToken})
  const reviews = await Review.find({user: user._id});
  // try catch, if else
  try {
    if (reviews) {
      res.status(200).json({
        success: true,
        response: reviews})
    } else {
      res.status(400).json({
        success: false, 
        message: "Please log in to GET reviews",
        response: e})
    }
  } catch(e) {
    res.status(500).json({
      success: false,
      response: e
    })
  } 
});

// Endpoint to find one specific review by one specific user (when logged in)

app.get("/reviews/:_id", authenticateUser);
app.get("/reviews/:_id", async (req, res) => {
  const accessToken = req.header("Authorization");
  const user = await User.findOne({accessToken});
  const singleReview = await Review.findById(req.params._id);
  // try catch, if else
  try {
    if (singleReview) {
      res.status(200).json({
        success: true, 
        response: singleReview})
    } else {
      res.status(400).json({
        success: false, 
        message: "Please log in to GET review",
        response: e})
    }
  } catch(e) {
    res.status(500).json({
      success: false,
      message: "Faulty ID",
      response: e
    })
  }
});


// Endpoint to delete one specific review by one specific user (when logged in)

app.delete("/reviews/:_id", authenticateUser);
app.delete("/reviews/:_id", async (req, res) => {
  const accessToken = req.header("Authorization");
  const user = await User.findOne({accessToken});
  const deletedReview = await Review.findByIdAndDelete(req.params._id);
  try {
    if (deletedReview) {
      res.status(200).json({
        success: true, 
        message: "Review successfully deleted",
        deletedReview: deletedReview})
    } else {
      res.status(400).json({
        success: false, 
        message: "Please log in to DELETE review",
        response: e})
    }
  } catch(e) {
    res.status(500).json({
      success: false,
      message: "Faulty ID",
      response: e
    })
  }
});



// Start the server
app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
