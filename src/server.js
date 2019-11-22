const express = require('express');
const cookieParser = require('cookie-parser');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const { createServer } = require('http');
const { ApolloServer } = require('apollo-server-express');
require('dotenv').config();
require('./db');

const User = require('./api/user/user.model');

const refreshSecret = process.env.REFRESH_JWT_SECRET;

const createToken = require('./utils/createToken');
const getCookie = require('./utils/getCookie');
const setCookie = require('./utils/setCookie');

// port in use
const port = process.env.PORT || 4000;

// graphql config object
const apiConfig = require('./api');

// cors options
const corsOptions = {
  origin: true,
  credentials: true
};

// express app
const app = express();

app.use(cors(corsOptions));
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
  const cookieOptions = {
    maxAge: 7 * 24 * 60 * 60 * 1000,
    httpOnly: true,
    secure: true,
    sameSite: 'None'
  };
  setCookie(res, 'refresh-token', newRefreshToken, cookieOptions);

  // create new access token and return it to client
  const accessToken = createToken({ userId }, 'access');
  return res.send({ ok: true, accessToken });
});

// instantiate server and pass in config object with typeDefs, resolvers, and ctx
const server = new ApolloServer({
  ...apiConfig,
  introspection: true,
  playground: true
});

// apply express app with options to apollo server
server.applyMiddleware({
  app,
  cors: false
});

const httpServer = createServer(app);
server.installSubscriptionHandlers(httpServer);

// prettier-ignore
httpServer.listen({ port }, () => {
  console.log(`🚀 Server - port: ${port}, endpoint: ${server.graphqlPath}`);
  console.log(`🚀 Subscriptions - port: ${port}, endpoint: ${server.subscriptionsPath}`
  );
});
