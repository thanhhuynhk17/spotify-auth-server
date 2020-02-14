const mongoose = require('mongoose');
// Using ES6 promise
mongoose.Promise = global.Promise;

const Schema = mongoose.Schema;

const track = new Schema({
  name:  String,
  id: String,
  uri: String,
  preview_url: String,
  external_url: String,
  vote: {
    type: Number,
    default: 1
  },
  lastUpdate: {
    type: Date,
    default: Date.now()
  }
});

module.exports = mongoose.model('sc_tracks',track);