import express from 'express';
import cors from 'cors';
import mongoose, { Schema } from 'mongoose';
import crypto from 'crypto';
import bcrypt from 'bcrypt';
const { Configuration, OpenAIApi } = require('openai');
import 'dotenv/config';
import e from 'express';

require('dotenv').config();

const mongoUrl =
  process.env.MONGO_URL || 'mongodb://127.0.0.1:27017/project-mongo';
mongoose.connect(mongoUrl, { useNewUrlParser: true, useUnifiedTopology: true });
mongoose.Promise = Promise;

const { OPENAI_API_KEY } = process.env;

const configuration = new Configuration({
  apiKey: OPENAI_API_KEY
});
const openai = new OpenAIApi(configuration);

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
  savedFavoriteBy: {
    type: [String],
    default: []
  },
});

// Virtual property for game release date (only year)

// A virtual property is not persisted in the database but behaves like a regular property for read operations.
// By using it here, we can access the year of a game's release as if it were a regular property.

gameSchema.virtual('release_year').get(function () {
  // must use regular function here, arrow functions do not bind their own this value
  const timestamp = this.first_release_date;
  const date = new Date(timestamp * 1000);
  return date.getFullYear();
  // return date.toLocaleDateString(); this will return the full date
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
  reviews: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Review'
    }
  ],
  /* favoriteGames: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Game'
    }
  ],
  playedGames: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Game'
    }
  ],
 /*  wantedGames: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Game'
    }
  ] */
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
  },
  game_name: {
    type: String,
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

// Protected route with admin authentication
// app.get('/fetch-games', authenticateAdmin, fetchAllGames)

// Authenticate admin middleware
// Ensures that only authenticated admins can access the endpoint and trigger the fetching process
// const authenticateAdmin = (req, res, next) => {
// Check if the user is authenticated and is an admin
// You can implement your own logic to verify the admin status
// For example, checking if the user has an admin role or a specific flag in their user object
// if (req.user && req.user.isAdmin) {

// Alternatively, comment out the function after the database has been populated

/////////////////////// User Endpoints

// Register user

app.post('/users/register', async (req, res) => {
  const { username, password } = req.body;
  try {
    const salt = bcrypt.genSaltSync();
    const hashedPassword = bcrypt.hashSync(password, salt);
    const newUser = await User.create({
      username: username,
      password: hashedPassword // Hash the password
    });
    res.status(201).json({
      success: true,
      response: {
        username: newUser.username,
        id: newUser._id,
        accessToken: newUser.accessToken,
        createdAt: newUser.createdAt,
        reviews: newUser.reviews,
        /* favoriteGames: newUser.favoriteGames,
        playedGames: newUser.playedGames */
      }
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: 'Could not register user',
      error: error.message
    });
  }
});

/////// Middlewares ///////

// Authenticate user
const authenticateUser = async (req, res, next) => {
  const accessToken = req.header('Authorization');
  try {
    const user = await User.findOne({ accessToken });
    if (user) {
      req.user = user;
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

// Pagnination middleware

const usePagination = async (req, res, next) => {
  const { page, size } = req.query;
  //if no size query is provided default is 20results shown on each page
  const pageHits = size ? parseInt(size) : 20;
  //if no page query is provided default is set to start at page 1
  const pageNumber = page ? parseInt(page) : 1;
  // Calculate the starting index for the current page
  // We subtract 1 from the page number because array numbering start at 0, while the first page number starts at 1
  const startIndex = (pageNumber - 1) * pageHits;
  // calculation to now which index to stop at for the page result
  const endIndex = startIndex + pageHits;

  req.pagination = {
    pageHits,
    pageNumber,
    startIndex,
    endIndex
  };

  next();
};

// Login user
app.post('/users/login', async (req, res) => {
  const { username, password } = req.body;
  try {
    const user = await User.findOne({ username });

    if (user && bcrypt.compareSync(password, user.password)) {
      res.status(200).json({
        success: true,
        response: {
          username: user.username,
          id: user._id,
          accessToken: user.accessToken,
          createdAt: user.createdAt,
          reviews: user.reviews,
          /* favoriteGames: user.favoriteGames,
          playedGames: user.playedGames */
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
  try {
    const user = await User.findById(userId);
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

// Retrieve all reviews

app.get('/reviews', async (req, res) => {
  try {
    const reviews = await Review.find().populate('user', 'username');
    if (reviews.length === 0) {
      // If there are no reviews
      res.status(200).json({
        success: true,
        response: [],
        message: 'There are no reviews'
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
      game: gameId,
      game_name: game.name
    });

    const savedReview = await newReview.save();

    // Update user's reviews array
    const updatedReviews = [...user.reviews, savedReview._id];
    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { reviews: updatedReviews },
      { new: true }
    );

    user.reviews.push(savedReview._id);
    // await user.save();

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

app.patch('/games/reviews/:_id', authenticateUser, async (req, res) => {
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

app.delete('/games/reviews/:_id', authenticateUser, async (req, res) => {
  const reviewId = req.params._id;
  try {
    const deletedReview = await Review.findByIdAndDelete(reviewId);
    if (deletedReview) {
      res.status(200).json({
        success: true,
        response: deletedReview
      });
    } else {
      res.status(400).json({
        success: false,
        message: 'Could not find review'
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

app.get('/games', usePagination, async (req, res) => {
  try {
    const games = await Game.find();
    const { pageHits, startIndex } = req.pagination;
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
  try {
    const singleGame = await Game.findById(req.params._id);
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

// Favorite games

// Get user's favorite games

app.get('/favoritegames', authenticateUser, async (req, res) => {
  const accessToken = req.header('Authorization');
  try {
    const user = await User.findOne({ accessToken });
    const userFavoriteGames = await Game.find({ savedFavoriteBy: user._id });

    if (userFavoriteGames.length) {
      res.status(200).json({
        success: true,
        response: userFavoriteGames
      });
    } else {
      res.status(400).json({
        success: false,
        message: 'no favorites found'
      });
    } 
  } catch (e) {
    res.status(500).json({
      success: false,
      message: 'Could not GET favorites',
      error: e.message
    });
  }
});

// Add or remove a game from user's favorites

app.patch('/games/:_id/addfavorite', authenticateUser, async (req, res) => {
  const { _id } = req.params;
  const accessToken = req.header('Authorization');
  try {
    const user = await User.findOne({ accessToken });
    const SpecificItem = await Game.findById(_id);

    const favoritesArray = SpecificItem.savedFavoriteBy;
    const UserExist = favoritesArray.find(userId => userId.toString() === user._id.toString());

    if (UserExist) {
      await Game.findByIdAndUpdate(_id, { $pull: { savedFavoriteBy: user._id } });
    } else {
      await Game.findByIdAndUpdate(_id, { $push: { savedFavoriteBy: user._id } });
    }

    const SavedItem = await Game.findById(_id);

    res.status(201).json({
      success: true,
      response: SavedItem
    });
  } catch (e) {
    res.status(400).json({
      success: false,
      message: 'Could not add favorite',
      error: e.message
    });
  }
});


/////// Filtering and sorting

// Retrieve a list of all game genres

app.get('/genres', async (req, res) => {
  try {
    const genres = await Game.distinct('genres.name'); // distinct() returns an array of unique values
    res.status(200).json({
      success: true,
      response: genres
    });
  } catch (e) {
    res.status(500).json({
      success: false,
      message: 'Could not GET genres',
      error: e.message
    });
  }
});

// Retrieve a list of genres for one specific game

app.get('/games/:_id/genres', async (req, res) => {
  try {
    const genres = await Game.findById(req.params._id).distinct('genres.name');
    if (genres.length === 0) {
      res.status(200).json({
        success: true,
        response: [],
        message: 'No genres found for this game'
      });
    } else {
      res.status(200).json({
        success: true,
        response: genres
      });
    }
  } catch (e) {
    res.status(500).json({
      success: false,
      message: 'Could not GET genres',
      error: e.message
    });
  }
});

// Retrieve games based on specific genre

app.get('/games/genres/:genre', async (req, res) => {
  const genre = req.params.genre;
  try {
    const games = await Game.find({ 'genres.name': genre });
    if (games.length === 0) {
      res.status(200).json({
        success: true,
        response: [],
        message: 'No games found for this genre'
      });
    } else {
      res.status(200).json({
        success: true,
        response: games
      });
    }
  } catch (e) {
    res.status(500).json({
      success: false,
      message: 'Could not GET games',
      error: e.message
    });
  }
});

// Sort by 
// For example, /games/genres/action?sortBy=rating

app.get('/games/genres/:genre', async (req, res) => {
  const genre = req.params.genre;
  const sortBy = req.query.sortBy || 'name'; // Default sort by name if sortBy query param is not provided

  try {
    const games = await Game.find({ 'genres.name': genre }).sort(sortBy);
    if (games.length === 0) {
      res.status(200).json({
        success: true,
        response: [],
        message: 'No games found for this genre'
      });
    } else {
      res.status(200).json({
        success: true,
        response: games
      });
    }
  } catch (e) {
    res.status(500).json({
      success: false,
      message: 'Could not GET games',
      error: e.message
    });
  }
});

// Retrieve a list of all game platforms

/* app.get('/platforms', async (req, res) => {
  const platforms = await Game.distinct('platforms.name');
  try {
    if (platforms.length === 0) {
      res.status(200).json({
        success: true,
        response: [],
        message: 'No platforms found'
      });
    } else {
      res.status(200).json({
        success: true,
        response: platforms
      });
    }
  } catch (e) {
    res.status(500).json({
      success: false,
      message: 'Could not GET platforms',
      error: e.message
    });
  }
});

// Retrieve a list of games based on a specific platform

app.get('/games/platforms/:platform', async (req, res) => {
  const platform = req.params.platform;
  try {
    const games = await Game.find({ 'platforms.name': platform });
    if (games.length === 0) {
      res.status(200).json({
        success: true,
        response: [],
        message: 'No games found for this platform'
      });
    } else {
      res.status(200).json({
        success: true,
        response: games
      });
    }
  } catch (e) {
    res.status(500).json({
      success: false,
      message: 'Could not GET games',
      error: e.message
    });
  }
});
 */
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
      res.status(404).json({
        success: false,
        message: 'No games found with that name',
        response: e
      });
    }
  } catch (e) {
    res.status(500).json({
      success: false,
      message: 'Could not GET games',
      error: e.message
    });
  }
});

// Sorting games based on release year

const sortGamesByReleaseYear = async (req, res) => {
  const { order } = req.query;

  try {
    // Fetch games from database
    const games = await Game.find();

    // Sort games by release year
    games.sort((a, b) => {
      const releaseYearA = a.release_year;
      const releaseYearB = b.release_year;

      if (releaseYearA < releaseYearB) {
        return order === 'asc' ? -1 : 1;
      }
      if (releaseYearA > releaseYearB) {
        return order === 'asc' ? 1 : -1;
      }
      return 0;
    });

    res.status(200).json({
      success: true,
      response: games
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to sort games',
      error: error.message
    });
  }
};

app.get('/games/sort', sortGamesByReleaseYear);
// Example usage: /games/sort?order=asc which will show oldest games first
// Or /games/sort?order=desc which will show newest games first

////////////////////// User collections
////////////////// Favorite games

// Add game to favourites (only for logged in users)

/* app.post('/users/:_id/favorites', authenticateUser, async (req, res) => {
  const userId = req.params._id;
  const { gameId } = req.body;

  try {
    // Find user by id
    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Check if game is already in favourites
    const isGameInFavorites = user.favoriteGames.some((favoriteGame) => favoriteGame._id.toString() === game._id.toString());
    if (isGameInFavorites) {
      return res.status(400).json({
        success: false,
        message: 'Game is already in favourites'
      });
    }

    // Add game to favourites
    await User.findByIdAndUpdate(userId, {
      $addToSet: { favoriteGames: gameId }
    }); // $addToSet prevents duplicates

    res.status(201).json({
      success: true,
      message: 'Game added to favorites'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Could not add game to favorites',
      error: error.message
    });
  }
});
// Get all favorite games (only for logged in users)

app.get('/users/:_id/favorites', authenticateUser, async (req, res) => {
  const userId = req.params._id;

  try {
    // Find user by id
    const user = await User.findById(userId).populate('favoriteGames');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const favoriteGames = user.favoriteGames;

    if (favoriteGames.length > 0) {
      res.status(200).json({
        success: true,
        response: favoriteGames
      });
    } else {
      res.status(200).json({
        success: true,
        response: [],
        message: 'No favorite games found'
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Could not GET favorite games',
      error: error.message
    });
  }
});

// Delete game from favourites (only for logged in users)

app.delete('/users/:_id/favorites', authenticateUser, async (req, res) => {
  const userId = req.params._id;

  try {
    // Find user by id
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Remove game from favourites

    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { $pull: { favoriteGames: gameId } },
      { new: true }
    );

    if (!updatedUser) {
      return res.status(404).json({
        success: false,
        message: 'Game not found in favorites'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Game removed from favorites',
      response: updatedUser.favoriteGames
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Could not remove game from favorites',
      error: error.message
    });
  }
}); */

////////////////// Played games

// Add game to played games (only for logged in users)

app.post('/games/:_id/played', authenticateUser, async (req, res) => {
  const gameId = req.params._id;
  const userId = req.user._id;

  try {
    // Find user by id
    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Check if game is already in played collection
    const isGameInPlayed = user.playedGames.includes(gameId);
    if (isGameInPlayed) {
      return res.status(400).json({
        success: false,
        message: 'Game is already in played collection'
      });
    }

    // Add game to played collection
    await User.findByIdAndUpdate(userId, {
      $addToSet: { playedGames: gameId }
    }); // $addToSet prevents duplicates

    res.status(201).json({
      success: true,
      message: 'Game added to played collection'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Could not add game to played collection',
      error: error.message
    });
  }
});

// Get all played games (only for logged in users)

app.get('/users/:_id/played', authenticateUser, async (req, res) => {
  const userId = req.params._id;

  try {
    // Find user by id
    const user = await User.findById(userId).populate('playedGames');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const playedGames = user.playedGames;

    if (playedGames.length > 0) {
      res.status(200).json({
        success: true,
        response: playedGames
      });
    } else {
      res.status(200).json({
        success: true,
        response: [],
        message: 'No played games found'
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Could not GET played games',
      error: error.message
    });
  }
});

// Delete game from played games (only for logged in users)

app.delete('/games/:_id/played', authenticateUser, async (req, res) => {
  const gameId = req.params._id;
  const userId = req.user._id;

  try {
    // Find user by id
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Remove game from played collection

    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { $pull: { playedGames: gameId } },
      { new: true }
    );

    if (!updatedUser) {
      return res.status(404).json({
        success: false,
        message: 'Game not found in played collection'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Game removed from played collection',
      response: updatedUser.playedGames
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Could not remove game from played collection',
      error: error.message
    });
  }
});

////////////////// Open AI API Generate image
app.post('/create', async (req, res) => {
  const { prompt } = req.body;
  try {
    const response = await openai.createImage({
      prompt,
      n: 1,
      size: '512x512'
    });
    res.send(response.data.data[0].url);
  } catch (err) {
    res.send(err.message);
  }
});

///////////////// Want to play collection

// Add game to wanted games (only for logged in users)

// Get all wanted games (only for logged in users)

// Delete game from wanted games (only for logged in users)

// Start the server
app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
