/**
 * This is an example of a basic node.js script that performs
 * the Authorization Code oAuth2 flow to authenticate against
 * the Spotify Accounts.
 *
 * For more information, read
 * https://developer.spotify.com/web-api/authorization-guide/#authorization_code_flow
 */

require('dotenv').config();
// var selfPing = require("heroku-self-ping");
// selfPing.HerokuSelfPing("https://spotify-auth-songcloud.herokuapp.com/", {
//     interval: 20 * 60 * 1000,
//     verbose: true
// });

var express = require('express'); // Express web server framework
var request = require('request'); // "Request" library
var cors = require('cors');
var querystring = require('querystring');
var cookieParser = require('cookie-parser');

// Database
const mongoose = require('mongoose');
const sc_track = require('../models/sc_track');
// Connect to DB
const options = {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  useFindAndModify: false
};

mongoose.connect(process.env.MONGO_URL, options).then(
  () => {
    console.log("==========================================");
    console.log("Database connection has been successfully!");
    console.log("==========================================");
  },
  err => {
    console.log("==========================================");
    console.log("Database connection error: " + err);
    console.log("==========================================");
  }
);

var client_id = process.env.CLIENT_ID; // Your client id
var client_secret = process.env.CLIENT_SECRET; // Your secret
// https://spotify-auth-songcloud.herokuapp.com/callback
// http://localhost:8888/callback
var redirect_uri = 'https://spotify-auth-songcloud.herokuapp.com/callback'; // Your redirect uri

var PORT = process.env.PORT || 8888;

/*
 * Generates a random string containing numbers and letters
 * @param  {number} length The length of the string
 * @return {string} The generated string
 */
var generateRandomString = function(length) {
  var text = '';
  var possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

  for (var i = 0; i < length; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
};

var stateKey = 'spotify_auth_state';

var app = express();

app.use(express.static(__dirname + '/public'))
   .use(cors())
   .use(cookieParser());

app.get('/login', function(req, res) {
  var state = generateRandomString(16);
  res.cookie(stateKey, state);
  
  // your application requests authorization
  var scope = 'user-read-private user-read-email streaming playlist-read-private playlist-modify-public';
  res.redirect('https://accounts.spotify.com/authorize?' +
    querystring.stringify({
      response_type: 'code',
      client_id: client_id,
      scope: scope,
      redirect_uri: redirect_uri,
      state: state
    }));
});

app.get('/callback', function(req, res) {
  // your application requests refresh and access tokens
  // after checking the state parameter
  var code = req.query.code || null;
  var state = req.query.state || null;
  var storedState = req.cookies ? req.cookies[stateKey] : null;
  if (state === null || state !== storedState) {
    res.redirect('/#' +
      querystring.stringify({
        error: 'state_mismatch'
      }));
  } else {
    res.clearCookie(stateKey);
    var authOptions = {
      url: 'https://accounts.spotify.com/api/token',
      form: {
        code: code,
        redirect_uri: redirect_uri,
        grant_type: 'authorization_code'
      },
      headers: {
        'Authorization': 'Basic ' + (new Buffer(client_id + ':' + client_secret).toString('base64'))
      },
      json: true
    };

    request.post(authOptions, function(error, response, body) {
      if (!error && response.statusCode === 200) {
        var access_token = body.access_token,
            refresh_token = body.refresh_token;

        var options = {
          url: 'https://api.spotify.com/v1/me',
          headers: { 'Authorization': 'Bearer ' + access_token },
          json: true
        };

        // use the access token to access the Spotify Web API
        request.get(options, function(error, response, body) {
          console.log("----------------------------");
          var d = new Date();
          console.log(d.toString());
          console.log("Country: " + body.country);
          console.log("Name: " + body.display_name);
          console.log("Email: " + body.email);
          console.log("ProductType: " + body.product);
          console.log("----------------------------");
        });

        // we can also pass the token to the browser to make requests from there
        // https://thanhhuynhk17.github.io/song-cloud.html#
        // http://localhost:5500/song-cloud.html#
        res.redirect('https://thanhhuynhk17.github.io/song-cloud.html#' +
          querystring.stringify({
            access_token: access_token,
            refresh_token: refresh_token,
          }));
      } else {
        res.redirect('/#' +
          querystring.stringify({
            error: 'invalid_token'
          }));
      }
    });
  }
});

app.get('/refresh_token', function(req, res) { 
  // requesting access token from refresh token
  var refresh_token = req.query.refresh_token;
    console.log("refresh_token: " + refresh_token);
  var authOptions = {
    url: 'https://accounts.spotify.com/api/token',
    headers: { 'Authorization': 'Basic ' + (new Buffer(client_id + ':' + client_secret).toString('base64')) },
    form: {
      grant_type: 'refresh_token',
      refresh_token: refresh_token
    },
    json: true
  };
    console.log(authOptions);
  request.post(authOptions, function(error, response, body) {
    if (!error && response.statusCode === 200) {
      var access_token = body.access_token;
      res.send({
        'access_token': access_token
      });
    }
  });
});

app.post('/test',(req, res) =>{
  console.log('test post method');
  if (req.query !== undefined) {
    console.log(req.query);
  }
  res.json({
    result: 1,
    message: 'test success'
  });
});

app.get('/tracks', (req, res) =>{
  // check db connection
  if (mongoose.connection.readyState) {
    sc_track.find()
      .then(data =>{
        res.json({
          result: 1,
          tracks: data,
          message: `get db success.`
        });
      })
      .catch(error =>{
        console.log(error);
        res.json({
          result: 0,
          message: `get db error.`
        });
      });

  // if didn't connect
  } else {
    res.json({
      result: 0,
      message: `didn't connect db.`
    });
  }

});

app.post('/addTrack', (req, res) => {
  let track = {};
  track.id = req.query.id;
  track.name = req.query.name;
  track.preview_url = req.query.preview_url;
  track.external_url = req.query.external_url;
  track.uri = req.query.uri;

  track = new sc_track(track);
  sc_track.findOneAndUpdate({ id: track.id }, { $inc:{vote: 1}})
    .then( (result)=>{
      if (result === null) {
        console.log("This is a new song");
        // track isn't exists, insert accepted
        track.save( (error,result) =>{
          // insert error
          if (error) {
            console.log ("Save data error: " + error);
            res.json({
              result: 0,
              data: {},
              message: `Save data error : ${error}`
            });
          // insert successfull
          }else{
            console.log("Add data success: ");
            console.log(result);
            res.json({
              result: 1,
              data: track,
              message: `Saved data success.`
            });
          }
        });
      // track exists, update vote
      }else{
        console.log("Update data success: ");
        console.log(track);
        res.json({
          result: 1,
          data: track,
          message: `Updated data success.`
        });
      }

    })
    .catch ( error =>{
      console.log("Update error: " + error);
    });


});

app.listen(PORT, () =>{
  console.log(`server running on port ${PORT}`);
});

// const detectDeviceType = () =>
//   /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
//     ? 'Mobile'
//     : 'Desktop';
 
// // Example
// detectDeviceType(); // "Mobile" or "Desktop"