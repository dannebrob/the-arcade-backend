import mongoose from 'mongoose';

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

const Review = mongoose.model('Review', reviewSchema);

export default Review;
