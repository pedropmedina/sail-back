const express = require('express');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const { createServer } = require('http');
const { ApolloServer } = require('apollo-server-express');
require('dotenv').config();
require('./db');

const createLoaders = require('./api/loaders');

const createTokens = require('./utils/createTokens');
const { setCookies, getCookies } = require('./utils/handleCookies');

const accessSecret = process.env.ACCESS_JWT_SECRET;
const refreshSecret = process.env.REFRESH_JWT_SECRET;

// graphql config object
const apiConfig = require('./api');

// express app
const app = express();

app.use(cors());
app.use(cookieParser());

app.use(async (req, res, next) => {
  // get cookies in request
  const { accessToken, refreshToken } = getCookies(req);

  // return early if both cookies have expired
  if (!accessToken && !refreshToken) {
    return next();
  }

  // check access token cookie expiration and skip remaining steps if valid
  try {
    const payload = jwt.verify(accessToken, accessSecret);
    req.userId = payload.userId;
    return next();
  } catch (error) {
    // move to the next line
  }

  // return early if refresh token has expired
  if (!refreshToken) {
    return next();
  }

  // check refresh token isn't blacklisted
  try {
    const loaders = createLoaders();
    const existingToken = await loaders.tokens.load(refreshToken);
    if (existingToken) {
      return next();
    }
  } catch (error) {
    // continue to the next line
  }

  // check if refresh token is still vaild
  try {
    const payload = jwt.verify(refreshToken, refreshSecret);
    const newTokens = createTokens(payload.userId);
    setCookies(res, newTokens);
    req.userId = payload.userId; // eslint-disable-line require-atomic-updates
    next();
  } catch (error) {
    return next();
  }
});

// instantiate server and pass in config object with typeDefs, resolvers, and ctx
const server = new ApolloServer(apiConfig);
server.applyMiddleware({ app });

const httpServer = createServer(app);
server.installSubscriptionHandlers(httpServer);

// prettier-ignore
app.listen({ port: 4000 }, () => {
  console.log(`🚀 Server ready at http://localhost:4000${server.graphqlPath}`);
  console.log(`🚀 Subscriptions readt at http://localhost:4000${server.subscriptionsPath}`
  );
});
