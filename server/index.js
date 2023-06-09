const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const session = require("express-session");
const redis = require("redis");
const socketHandler = require("./sockets/index");
let RedisStore = require("connect-redis").default;

// Import environment variables from the config file
const {
  MONGO_USER,
  MONGO_PASSWORD,
  MONGO_IP,
  MONGO_PORT,
  REDIS_URL,
} = require("./config/config");

// Create Redis client and store
let redisClient = redis.createClient({ url: "redis://redis", host: REDIS_URL });
let redisStore = new RedisStore({ client: redisClient });

// Initialize Express app
const app = express();
const port = process.env.PORT || 4000;

// Create MongoDB connection URL
const mongoUrl = `mongodb://${MONGO_USER}:${MONGO_PASSWORD}@${MONGO_IP}:${MONGO_PORT}/?authSource=admin`;

// Import router modules for routing
const userRouter = require("./routes/userRoutes");
const productRouter = require("./routes/productRoutes");

// parsing json for the request body
app.use(express.json());

// Enable CORS for incoming requests from a specific origin
app.use(
  cors({
    credentials: true,
    origin: "http://localhost:3000",
  })
);

// to allow data transfer between client and server
const http = require("http").Server(app);

const socketIO = require("socket.io")(http, {
  // setted the cors origin to allow connections to react client
  cors: {
    origin: "http://localhost:3000",
  },
});
// Pass to socket to handler to handle socket events from sockets/index.js
socketHandler(socketIO);

// Connect to Redis server
redisClient.connect().catch((err) => {
  console.log(err);
});

// Use RedisStore for session management
app.use(
  session({
    name: "sid",
    store: redisStore,
    secret: "secret",
    cookie: {
      maxAge: 60000 * 60 * 24,
      httpOnly: true,
      secure: false,
      sameSite: "lax",
    },
    saveUninitialized: false,
    resave: false,
  })
);

const connectWithRetry = () => {
  mongoose
    .connect(mongoUrl, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    })
    .then(() => console.log("successfully connected to the database"))
    .catch((err) => {
      console.log(err);
      // retry to connect after 5 seconds if connection fails
      setTimeout(connectWithRetry, 5000);
    });
};
//connect to the database
connectWithRetry();

app.get("/", (req, res) => {
  res.send("Hello World!");
});

app.use("/users", userRouter);
app.use("/products", productRouter);

// Listen for incoming HTTP requests on the specified port
http.listen(port, () => {
  console.log(`Server started on port ${port}`);
});
