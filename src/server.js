const express = require('express');
const cookieParser = require('cookie-parser');
const jwt = require('jsonwebtoken');
const { createServer } = require('http');
const { ApolloServer } = require('apollo-server-express');
require('dotenv').config();
require('./db');

const User = require('./api/user/user.model');

const refreshSecret = process.env.REFRESH_JWT_SECRET;

const createToken = require('./utils/createToken');
const getCookie = require('./utils/getCookie');
const setCookie = require('./utils/setCookie');

// graphql config object
const apiConfig = require('./api');

// express app
const app = express();

app.use(cookieParser());

app.post('/refresh_token', async (req, res) => {
  // check refresh token in cookies and return early if not found meaning
  const refreshToken = getCookie(req, 'refresh-token');
  if (!refreshToken) {
    return res.send({ ok: false, accessToken: '' });
  }

  // verify refresh token validity and asign payload, else return early
  let payload = null;
  try {
    payload = jwt.verify(refreshToken, refreshSecret);
  } catch (error) {
    console.log({ error });
    return res.send({ ok: false, accessToken: '' });
  }

  // get user with userId in payload and return early if no user found with given id
  const { userId, tokenVersion } = payload;
  const user = await User.findById(userId).exec();
  if (!user) {
    return res.send({ ok: false, accessToken: '' });
  }

  // validate token by comparing it the current token version in user
  if (user.tokenVersion !== tokenVersion) {
    return res.send({ ok: false, accessToken: '' });
  }

  // create a new refresh token to exteding it validity for 7 more days
  const newRefreshToken = createToken(
    { userId: user._id, tokenVersion: user.tokenVersion },
    'refresh'
  );
  const cookieOptions = { maxAge: 7 * 24 * 60 * 60 * 1000, httpOnly: true };
  setCookie(res, 'refresh-token', newRefreshToken, cookieOptions);

  // create new access token and return it to client
  const accessToken = createToken({ userId }, 'access');
  return res.send({ ok: true, accessToken });
});

// instantiate server and pass in config object with typeDefs, resolvers, and ctx
const server = new ApolloServer(apiConfig);

// cors options
const corsOptions = {
  origin: true,
  credentials: true
};

// apply express app with options to apollo server
server.applyMiddleware({
  app,
  cors: corsOptions
});

const httpServer = createServer(app);
server.installSubscriptionHandlers(httpServer);

// prettier-ignore
httpServer.listen({ port: 4000 }, () => {
  console.log(`🚀 Server ready at http://localhost:4000${server.graphqlPath}`);
  console.log(`🚀 Subscriptions readt at http://localhost:4000${server.subscriptionsPath}`
  );
});
