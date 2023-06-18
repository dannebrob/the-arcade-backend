import mongoose from 'mongoose';

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
  ]
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

const User = mongoose.model('User', userSchema);

export default User;
