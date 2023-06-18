import express from 'express';

import User from '../models/user.js';
import Game from '../models/game.js';
import authenticateUser from '../middleware/authenticateUser.js';
import usePagination from '../middleware/usePagination.js';

const router = express.Router();

router.get('/genres', async (req, res) => {
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

router.get('/games/:_id/genres', async (req, res) => {
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

// Get all games and sort them by genre and release date
// Example: games?genre=action&sort=releasedDesc

router.get('/games', usePagination, async (req, res) => {
  try {
    const { pageHits, startIndex } = req.pagination;
    /*  const genre = req.params.genre; */
    /* const sortBy = req.query.sortBy || 'name'; // Default sort by name if sortBy query param is not provided */
    const { genre, sort } = req.query;
    let query = {};

    if (genre) {
      query['genres.name'] = genre;
    }

    if (sort !== '') {
      query.first_release_date = { $exists: true };
    }
    // default sort values
    let sortByProperty = 'name';
    let sortDirection = 'asc';

    // check if sort query param is provided
    if (sort === 'releasedDesc') {
      sortByProperty = 'first_release_date';
      sortDirection = 'desc';
    } else if (sort === 'releasedAsce') {
      sortByProperty = 'first_release_date';
      sortDirection = 'asc';
    }

    /* check if release date exists in the game object */

    let games = await Game.find(query)
      .sort({ [sortByProperty]: sortDirection })
      .skip(startIndex)
      .limit(pageHits);

    let totalGames = await Game.countDocuments(query);

    let filteredGames = games;

    if (games.length === 0) {
      res.status(200).json({
        success: true,
        response: [],
        message: 'No games found for this genre'
      });
    } else {
      res.status(200).json({
        success: true,
        response: {
          games: filteredGames,
          total: totalGames
        }
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

// Searching for games based on a query string

router.get('/games', async (req, res) => {
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

// Endpoint to get one specific game

router.get('/games/:_id', async (req, res) => {
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

router.get('/favoritegames', authenticateUser, async (req, res) => {
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

router.patch('/games/:_id/addfavorite', authenticateUser, async (req, res) => {
  const { _id } = req.params;
  const accessToken = req.header('Authorization');
  try {
    const user = await User.findOne({ accessToken });
    const SpecificItem = await Game.findById(_id);

    const favoritesArray = SpecificItem.savedFavoriteBy;
    const UserExist = favoritesArray.find(
      (userId) => userId.toString() === user._id.toString()
    );

    if (UserExist) {
      await Game.findByIdAndUpdate(_id, {
        $pull: { savedFavoriteBy: user._id }
      });
    } else {
      await Game.findByIdAndUpdate(_id, {
        $push: { savedFavoriteBy: user._id }
      });
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

export default router;
