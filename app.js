/**
 * Copyright (C) 2017 Genome Research Ltd
 * See license in LICENSE
 */

'use strict';

const fs = require('fs');
const https = require('https');
const path = require('path');

const bodyParser = require('body-parser');
const express = require('express');
const helmet = require('helmet');

const model = require('./lib/model');

const PORT = process.argv[2] || 8000;
const httpsopts = {
  key: fs.readFileSync('./certs/priv.key'),
  cert: fs.readFileSync('./certs/cert.pem')
};

const creation_msg = 'Created by owner via web interface';
const revocation_msg = 'Revoked by owner via web interface';


const app = express();
const serv = https.createServer(httpsopts, app);

app.use(helmet({
  hsts: false
}));

app.set('view engine', 'ejs');

app.use(bodyParser.json());

app.post('/createToken', function(req, res, next) {
  // Does not expect any request body.
  // Generates a random 32 character string and enters it
  // into the db.
  // Returns the new document as an application/json body.
  let user = 'an8@sanger.ac.uk'; //req.headers['X-Remote-User'];

  model.createToken(user, creation_msg).then(function(response) {
    res.status(200).json(response);
  }, next);
});

app.post('/revokeToken', function(req, res, next) {
  // Expects body of application/json containing only the token
  // which is to be rejected. Updates the document in db so that
  // the 'status' field is set to 'revoked'.
  // Returns the updated document in  an application/json body.
  let user = 'an8@sanger.ac.uk'; //req.headers['X-Remote-User'];
  let token;

  try {
    token = req.body.token;
  } catch (e) {
    next(e);
  }

  model.revokeToken(user, token, revocation_msg).then(function(row) {
    res.status(200).json(row);
  }, next);
});

app.post('/checkToken', function(req, res, next) {
  // Expects application/json request body to include a token and
  // an array of group ids. Finds the user owning that token from db,
  // then finds the groups that user is a member of.
  // Returns {ok: true} if user's group membership is a superset of
  // groups specified in request body.
  let token = req.body.token;
  let groups = req.body.groups;

  model.checkToken(groups, token).then(function(decision) {
    res.status(200).json({ok: decision});
  }, next);
});

app.get('/listTokens', function(req, res, next) {
  // Returns all documents in db where user matches the
  // X-Remote-User header as an application/json array.
  let user = 'an8@sanger.ac.uk';

  model.listTokens(user).then(function(docs) {
    res.status(200).json(docs);
  }, next);
});

app.use(express.static(path.join(__dirname, 'public')));

app.use(function(req, res) {
  let statusCode = 404;
  res.status(statusCode)
    .render(path.join(__dirname, 'views', 'error'),
      {err: 'Not Found', statusCode});
});

// 'next' is unused, but required for express to see this
// as error-handling middleware
//
// https://expressjs.com/en/4x/api.html#description
/* eslint-disable no-unused-vars */
app.use(function(err, req, res, next) {
/* eslint-enable no-unused-vars */
  console.error(err.stack);
  let statusCode = 500;
  res.status(statusCode).json({
    status: statusCode,
    err: 'Internal server error'
  });
});

serv.listen(PORT);
console.error(`express started on port ${PORT}`);
