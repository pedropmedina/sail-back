const { ApolloServer } = require('apollo-server');

// graphql config object
const apiConfig = require('./api');

// instantiate server and pass in config object with typeDefs, resolvers, and ctx
const server = new ApolloServer(apiConfig);

console.log({ nodeEnv: process.env.NODE_ENV });

server.listen().then(({ url }) => {
  console.log(`Server is up at ${url}`);
});
