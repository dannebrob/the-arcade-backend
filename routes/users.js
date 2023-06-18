import express from 'express';
import bcrypt from 'bcrypt';
import User from '../models/user.js';
import authenticateUser from '../middleware/authenticateUser.js';

const router = express.Router();

router.post('/users/register', async (req, res) => {
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
        reviews: newUser.reviews
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

// Login user
router.post('/users/login', async (req, res) => {
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
          reviews: user.reviews
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

router.get('/users/:_id', async (req, res) => {
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

router.patch('/users/:_id', authenticateUser, async (req, res) => {
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

router.delete('/users/:_id', authenticateUser, async (req, res) => {
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

// Fetch all users

router.get('/users', async (req, res) => {
  try {
    const users = await User.find();
    if (users.length === 0) {
      // If there are no users
      res.status(200).json({
        success: true,
        response: [],
        message: 'There are no users'
      });
    } else {
      res.status(200).json({
        success: true,
        response: users
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve users',
      error: error.message
    });
  }
});

export default router;
