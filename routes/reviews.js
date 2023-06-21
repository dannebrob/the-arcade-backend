import express from 'express';
import User from '../models/user.js';
import Review from '../models/review.js';
import Game from '../models/game.js';
import authenticateUser from '../middleware/authenticateUser.js';

const router = express.Router();

router.get('/reviews', async (req, res) => {
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

router.get('/games/:_id/reviews', async (req, res) => {
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

router.get('/users/:_id/reviews', async (req, res) => {
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

router.post('/games/:_id/reviews', authenticateUser, async (req, res) => {
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

router.patch('/games/reviews/:_id', authenticateUser, async (req, res) => {
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

router.delete('/games/reviews/:_id', authenticateUser, async (req, res) => {
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

export default router;
