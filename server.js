import express from 'express';
import cors from 'cors';
import mongoose, { Schema } from 'mongoose';
import crypto from 'crypto';
import bcrypt from 'bcrypt';
import 'dotenv/config';
import { error } from 'console';

require('dotenv').config();

const mongoUrl =
  process.env.MONGO_URL || 'mongodb://127.0.0.1:27017/project-mongo';
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
app.get('/', (req, res) => {
  res.send('Hello Hello!');
});

////////////////// Create schemas and models
// Database schema

const gameSchema = new mongoose.Schema({
  name: String,
  cover: {
    url: String
  },
  first_release_date: Number,
  genres: [
    {
      name: String
    }
  ],
  summary: String,
  slug: String,
  involved_companies: [
    {
      company: {
        name: String
      }
    }
  ],
  rating: Number,
  screenshots: [
    {
      url: String
    }
  ],
  platforms: [
    {
      name: String
    }
  ],
  rating: Number
});

// User schema

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
    default: () => crypto.randomBytes(128).toString('hex')
  },
  createdAt: {
    type: Date,
    default: () => new Date()
  },
  reviews: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Review'
  }
});

// Review schema

const reviewSchema = new mongoose.Schema({
  message: {
    type: String
  },
  createdAt: {
    type: Date,
    default: () => new Date()
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  game: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Game',
    required: true
  }
  // Some type of like functionality?
});

/////////////////// Create models

const Game = mongoose.model('Game', gameSchema);
const User = mongoose.model('User', userSchema);
const Review = mongoose.model('Review', reviewSchema);

///////////////////

// Populate database with games from IGDB API
const fetchAndSaveGames = async (offset, batchSize) => {
  try {
    const response = await fetch('https://api.igdb.com/v4/games', {
      method: 'POST',
      headers: {
        'Authorization': process.env.IGDB_CLIENT_SECRET,
        'Client-ID': process.env.IGDB_CLIENT_ID,
        Accept: 'application/json'
      },
      body: `fields name, cover.url, first_release_date, platforms.name, genres.name, summary, slug, involved_companies.company.name, rating, screenshots.url; where platforms = 52; limit ${batchSize}; offset ${offset};`
    });
    const games = await response.json();
    console.log(games);

    // Save each game to the database
    for (const game of games) {
      const ratingResponse = await fetch(
        'https://api.igdb.com/v4/game_ratings',
        {
          method: 'POST',
          headers: {
            'Authorization': process.env.IGDB_CLIENT_SECRET,
            'Client-ID': process.env.IGDB_CLIENT_ID,
            Accept: 'application/json'
          },
          body: `fields rating; where game = ${game.id}; limit 1; sort rating desc;`
        }
      );
      const ratingData = await ratingResponse.json();
      const rating = ratingData.length > 0 ? ratingData[0].rating : 0;

      const gameWithRating = { ...game, rating };
      await new Game(gameWithRating).save();
    }

    return games.length; // Return the number of games fetched in this batch
  } catch (error) {
    console.error(error);
    return 0;
  }
};

const fetchAllGames = async () => {
  const batchSize = 1; // Number of games to fetch in each batch
  const totalGames = 10000; // Total number of games to fetch

  const delay = 250; // Delay in milliseconds (4 requests per second)
  let offset = 0; // Initial offset

  try {
    let totalCount = 0;
    let fetchedCount = 0;

    while (totalCount < totalGames) {
      fetchedCount = await fetchAndSaveGames(offset, batchSize);
      totalCount += fetchedCount;
      offset += batchSize;

      // Delay between API calls
      if (totalCount < totalGames) {
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }

    console.log(`Total games fetched and saved: ${totalCount}`);
  } catch (error) {
    console.error(error);
  }
};

app.get('/fetch-games', fetchAllGames);

// A Review model is not necessarily needed, but can be handy for additional review
// specific functionalities, such as adding likes, comments
// const Review = mongoose.model("Review", reviewSchema);

/////////////////////// User Endpoints

// Register user

app.post('/users/register', async (req, res) => {
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
      });
    } else {
      res.status(400).json({
        success: false,
        response: 'Could not register user'
      });
    }
  } catch (e) {
    res.status(400).json({
      success: false,
      message: 'Could not register user',
      response: e
    });
  }
});

// Authenticate user
const authenticateUser = async (req, res, next) => {
  const accessToken = req.header('Authorization');
  try {
    const user = await User.findOne({ accessToken });
    if (user) {
      next();
    } else {
      res.status(401).json({
        success: false,
        response: 'Please log in'
      });
    }
  } catch (e) {
    res.status(500).json({
      success: false,
      message: 'Could not authenticate user',
      response: e
    });
  }
};

// get game data

// Login user
app.post('users/login', async (req, res) => {
  const { username, password } = req.body;
  try {
    const user = await User.findOne({ username });
    if (user && bcrypt.compareSync(password, user.password)) {
      res.status(201).json({
        success: true,
        response: {
          username: user.username,
          id: user._id,
          accessToken: user.accessToken,
          createdAt: user.createdAt
        }
      });
    } else {
      res.status(400).json({
        success: false,
        message: 'Credentials do not match'
      });
    }
  } catch (e) {
    res.status(500).json({
      success: false,
      message: 'Could not log in user',
      response: e
    });
  }
});

// Retrieve user details by ID

app.get('/users/:_id', async (req, res) => {
  const userId = req.params._id;
  const user = await User.findById(userId);
  try {
    if (user) {
      res.status(200).json({
        success: true,
        response: user
      });
    } else {
      res.status(400).json({
        success: false,
        message: 'Faulty user ID',
        response: e
      });
    }
  } catch (e) {
    res.status(500).json({
      success: false,
      message: 'Could not GET user details',
      response: e
    });
  }
});

// Update user details

app.patch('/users/:_id', authenticateUser, async (req, res) => {
  const userId = req.params._id;
  const updates = req.body;
  try {
    const updatedUser = await User.findByIdAndUpdate(userId, updates, {
      new: true
    });
    if (updatedUser) {
      res.status(200).json({
        success: true,
        response: updatedUser
      });
    } else {
      res.status(400).json({
        success: false,
        message: 'Faulty user ID',
        response: e
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Could not update user details',
      error: error.message
    });
  }
});

// Delete user

app.delete('/users/:_id', authenticateUser, async (req, res) => {
  const userId = req.params._id;
  try {
    const deletedUser = await User.findByIdAndDelete(userId);
    if (deletedUser) {
      res.status(200).json({
        success: true,
        response: deletedUser
      });
    } else {
      res.status(400).json({
        success: false,
        message: 'Faulty user ID',
        response: e
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Could not delete user',
      error: error.message
    });
  }
});

/////////////////////// User Endpoints END

/////////////////////// Review Endpoints

// Retrieve all reviews for a specific game

app.get('/games/:_id/reviews', async (req, res) => {
  const gameId = req.params._id;
  try {
    const reviews = await Review.find({ game: gameId }).populate(
      'user',
      'username'
    );

    if (reviews.length === 0) {
      // If game has no reviews
      res.status(200).json({
        success: true,
        response: []
      });
    } else {
      res.status(200).json({
        success: true,
        response: reviews
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve reviews',
      error: error.message
    });
  }
});

// Retrieve all reviews by one specific user

app.get('/users/:_id/reviews', async (req, res) => {
  const userId = req.params._id;
  try {
    const reviews = await Review.find({ user: userId }).populate(
      'game',
      'name'
    );

    if (reviews.length === 0) {
      // If user has not posted any reviews
      res.status(200).json({
        success: true,
        response: []
      });
    } else {
      res.status(200).json({
        success: true,
        response: reviews
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve reviews',
      error: error.message
    });
  }
});

// Post new review (only for logged in users)

app.post('/games/:_id/reviews', authenticateUser, async (req, res) => {
  const gameId = req.params._id;
  const { message, userId } = req.body;
  try {
    const user = await User.findById(userId);
    const game = await Game.findById(gameId);
    if (!user) {
      return res.status(400).json({
        success: false,
        message: 'User not found'
      });
    }
    if (!game) {
      return res.status(400).json({
        success: false,
        message: 'Game not found'
      });
    }

    const newReview = await new Review({
      message: message,
      user: userId,
      game: gameId
    });

    const savedReview = await newReview.save();

    // Update user's reviews array
    const updatedReviews = [...user.reviews, savedReview._id];
    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { reviews: updatedReviews },
      { new: true }
    );

    // user.reviews.push(savedReview._id);
    //  await user.save();

    res.status(201).json({
      success: true,
      response: savedReview
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to POST review',
      error: error.message
    });
  }
});

// Update a review (only for logged in users)

app.patch('/reviews/:_id', authenticateUser, async (req, res) => {
  const reviewId = req.params._id;
  const updates = req.body;
  try {
    const updatedReview = await Review.findByIdAndUpdate(reviewId, updates, {
      new: true
    });
    if (updatedReview) {
      res.status(200).json({
        success: true,
        response: updatedReview
      });
    } else {
      res.status(400).json({
        success: false,
        message: 'Could not find review',
        response: e
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Could not update review',
      error: error.message
    });
  }
});

// Delete a review (only for logged in users)

app.delete('/reviews/:_id', authenticateUser, async (req, res) => {
  const reviewId = req.params._id;
  const deletedReview = await Review.findByIdAndDelete(reviewId);
  try {
    if (deletedReview) {
      res.status(200).json({
        success: true,
        response: deletedReview
      });
    } else {
      res.status(400).json({
        success: false,
        message: 'Could not find review',
        response: e
      });
    }
  } catch (e) {
    res.status(500).json({
      success: false,
      message: 'Could not delete review',
      error: e.message
    });
  }
});

////////////////////////////// Review Endpoints END

////////////////////////////// Games endpoints

// Endpoint to get all games

app.get('/games', async (req, res) => {
  const games = await Game.find();
  try {
    if (games) {
      res.status(200).json({
        success: true,
        response: games
      });
    } else {
      res.status(400).json({
        success: false,
        message: 'Could not GET games'
      });
    }
  } catch (e) {
    res.status(500).json({
      success: false,
      error: e.message
    });
  }
});

// Endpoint to get one specific game

app.get('/games/:_id', async (req, res) => {
  const singleGame = await Game.findById(req.params._id);
  try {
    if (singleGame) {
      res.status(200).json({
        success: true,
        response: singleGame
      });
    } else {
      res.status(400).json({
        success: false,
        message: 'Could not find game'
      });
    }
  } catch (e) {
    res.status(500).json({
      success: false,
      message: 'Could not GET game',
      error: e.message
    });
  }
});

/////// Filtering and sorting

// Retrieve a list of all game genres

app.get('/games', async (req, res) => {
  const categories = await Game.find().distinct('category'); // distinct() returns an array of unique values
  try {
    if (categories) {
      res.status(200).json({
        success: true,
        response: categories
      });
    } else {
      res.status(400).json({
        success: false,
        message: 'Could not GET categories',
        response: e
      });
    }
  } catch (e) {
    res.status(500).json({
      success: false,
      response: e
    });
  }
});

// Retrieve games based on specific category
// Example: /games?category=retro

app.get('/games', async (req, res) => {
  const category = req.query.category;
  const games = await Game.find({ category: category });
  try {
    if (games) {
      res.status(200).json({
        success: true,
        response: games
      });
    } else {
      res.status(400).json({
        success: false,
        message: 'No games found with that category',
        response: e
      });
    }
  } catch (e) {
    res.status(500).json({
      success: false,
      response: e
    });
  }
});

// Retrieve a list of all game platforms

app.get('/games', async (req, res) => {
  const platforms = await Game.find().distinct('platform');
  try {
    if (platforms) {
      res.status(200).json({
        success: true,
        response: platforms
      });
    } else {
      res.status(400).json({
        success: false,
        message: 'Could not GET platforms',
        response: e
      });
    }
  } catch (e) {
    res.status(500).json({
      success: false,
      response: e
    });
  }
});

// Searching for games based on a query string

app.get('/games', async (req, res) => {
  const search = req.query.search;
  const escapedSearch = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); // Escape special characters
  const regex = new RegExp(escapedSearch, 'i'); // Perform case-insensitive search
  const games = await Game.find({ name: { $regex: regex } });
  try {
    if (games.length > 0) {
      res.status(200).json({
        success: true,
        response: games
      });
    } else {
      res.status(400).json({
        success: false,
        message: 'No games found with that name',
        response: e
      });
    }
  } catch (e) {
    res.status(500).json({
      success: false,
      response: e
    });
  }
});

// Start the server
app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
