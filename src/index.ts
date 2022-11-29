import "dotenv-safe/config";
import "reflect-metadata";
import { COOKIE_NAME, __prod__ } from "./constants";
import express from "express";
import { buildSchema } from "type-graphql";
import { ApolloServer } from "apollo-server-express";
import { PostResolver } from "./resolvers/post";
import { UserResolver } from "./resolvers/user";
import Redis from "ioredis";
import session from "express-session";
import connectRedis from "connect-redis";
import cors from "cors";
import { AppDataSource } from "./ormconfig";
import { createUserLoader } from "./utils/createUserLoader";
// import { Post } from "./entities/Post";

const main = async () => {
  await AppDataSource.initialize()
    .then(() => {
      console.log("typeorm initialize works");
    })
    .catch((error) => console.error(error, "typeorm initialize does not work"));
  await AppDataSource.runMigrations();

  // await Post.delete({});
  // res

  const app = express();

  app.set("trust proxy", 1);

  const RedisStore = connectRedis(session);
  const redis = new Redis(process.env.REDIS_URL);
  if (!redis.status) {
    await redis.connect();
  }

  app.use(
    cors({
      origin: [process.env.CORS_ORIGIN],
      credentials: true,
    })
  );

  app.use(
    session({
      name: COOKIE_NAME,
      store: new RedisStore({ client: redis, disableTouch: true }),
      cookie: {
        maxAge: 1000 * 60 * 60 * 24 * 365 * 10,
        httpOnly: true,
        sameSite: "lax",
        secure: __prod__,
      },
      saveUninitialized: false,
      secret: process.env.SESSION_SECRET,
      resave: false,
    })
  );

  const apolloServer = new ApolloServer({
    schema: await buildSchema({
      resolvers: [PostResolver, UserResolver],
      validate: false,
    }),
    context: ({ req, res }) => ({
      req,
      res,
      redis,
      userLoader: createUserLoader(),
    }),
  });

  await apolloServer.start();

  apolloServer.applyMiddleware({
    app,
    cors: false,
  });

  app.listen(parseInt(process.env.PORT), () => {
    console.log("server started on http://localhost:4000");
  });
};

main();