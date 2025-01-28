const express = require("express");
const app = express();
const cors = require("cors");
const jwt = require("jsonwebtoken");
require("dotenv").config();
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const port = process.env.PORT || 5000;

// middleWare
app.use(cors());
app.use(express.json());

// mongodb url

const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const { default: Stripe } = require("stripe");
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.s64u1mi.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();

    // all collection here

    const userCollection = client.db("Traveling").collection("users");
    const bookingCollection = client.db("Traveling").collection("booking");
    const placeCollection = client.db("Traveling").collection("place");
    const reviewsCollection = client.db("Traveling").collection("reviews");
    const galleryCollection = client.db("Traveling").collection("gallery");
    const reservationCollection = client
      .db("Traveling")
      .collection("reservation");
    const paymentCollection = client.db("Traveling").collection("payment");
    // all query here

    // jwt api
    app.post("/jwt", async (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: "1h",
      });
      res.send({ token });
    });

    // middleware
    const verifyToken = (req, res, next) => {
      // console.log("verify", req.headers);
      if (!req.headers.authorization) {
        return res.status(401).send({ message: "Unauthorized Access" });
      }
      const token = req.headers.authorization.split(" ")[1];
      jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (error, decoded) => {
        if (error) {
          return res.status(401).send({ message: "Unauthorized Access" });
        }
        req.decoded = decoded;

        next();
      });
    };

    const verifyAdmin = async (req, res, next) => {
      const email = req.decoded.email;
      const query = { email: email };
      const user = await userCollection.findOne(query);
      const isAdmin = user?.role === "admin";
      if (!isAdmin) {
        return res.status(403).send({ message: "forbidden access" });
      }
      next();
    };

    app.post("/users", async (req, res) => {
      const user = req.body;
      const query = { email: user.email };
      const existingUser = await userCollection.findOne(query);
      if (existingUser) {
        return res.send({ message: "user already exists", insertedId: null });
      }
      const result = await userCollection.insertOne(user);
      res.send(result);
    });

    app.get("/users", verifyToken, verifyAdmin, async (req, res) => {
      const result = await userCollection.find().toArray();
      res.send(result);
    });

    app.get("/users/admin/:email", verifyToken, async (req, res) => {
      const email = req.params.email;
      if (email !== req.decoded.email) {
        return res.status(403).send({ message: "forbidden access" });
      }
      const query = { email: email };
      const user = await userCollection.findOne(query);
      let admin = false;
      if (user) {
        admin = user?.role === "admin";
      }
      res.send({ admin });
    });

    app.delete("/users/:id", verifyToken, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await userCollection.deleteOne(query);
      res.send(result);
    });

    app.patch("/users/:id", async (req, res) => {
      const id = req.params.id;

      if (!id) {
        return res.status(400).send({ message: "User ID is required." });
      }
      const { lastSignInTime, ...otherUpdates } = req.body; // Get the lastSignInTime from the request body

      if (lastSignInTime && isNaN(Date.parse(lastSignInTime))) {
        return res
          .status(400)
          .send({ message: "Invalid lastSignInTime format." });
      }

      const query = { id: id };

      const updatedUser = {
        $set: {
          ...(lastSignInTime && { "metadata.lastSignInTime": lastSignInTime }),
          ...otherUpdates,
        },
      };
      const result = await userCollection.updateOne(query, updatedUser);
      res.send(result);
    });

    app.patch(
      "/users/admin/:id",
      verifyToken,
      verifyAdmin,
      async (req, res) => {
        const id = req.params.id;
        const query = { _id: new ObjectId(id) };
        const updatedUser = {
          $set: {
            role: "admin",
          },
        };
        const result = await userCollection.updateOne(query, updatedUser);
        res.send(result);
      }
    );

    app.get("/place", async (req, res) => {
      const result = await placeCollection.find().toArray();
      res.send(result);
    });

    app.get("/place/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await placeCollection.findOne(query);
      res.send(result);
    });

    app.post("/place", verifyToken, verifyAdmin, async (req, res) => {
      const place = req.body;
      const result = await placeCollection.insertOne(place);
      res.send(result);
    });
    app.delete("/place/:id", verifyToken, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await placeCollection.deleteOne(query);
      res.send(result);
    });

    app.patch("/place/:id", verifyToken, verifyAdmin, async (req, res) => {
      const item = req.body;
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const updatedDoc = {
        $set: {
          placeName: item.placeName,
          price: item.price,
          rating: item.rating,
          description: item.description,
          email: item.email,
          location: item.location,
          serviceCharge: item.serviceCharge,
          img: item.img,
        },
      };
      const result = await placeCollection.updateOne(query, updatedDoc);
      res.send(result);
    });

    // reviews
    app.get("/reviews", async (req, res) => {
      const result = await reviewsCollection.find().toArray();
      res.send(result);
    });
    app.post("/reviews", async (req, res) => {
      const review = req.body;
      const result = await reviewsCollection.insertOne(review);
      res.send(result);
    });
    // reviews
    app.get("/gallery", async (req, res) => {
      const result = await galleryCollection.find().toArray();
      res.send(result);
    });
    app.post("/gallery", async (req, res) => {
      const review = req.body;
      const result = await galleryCollection.insertOne(review);
      res.send(result);
    });
    // cart
    app.post("/booking", async (req, res) => {
      const bookingItem = req.body;
      const result = await bookingCollection.insertOne(bookingItem);
      res.send(result);
    });

    app.get("/booking", verifyToken, async (req, res) => {
      const email = req.query.email;
      const query = { email: email };
      const result = await bookingCollection.find(query).toArray();
      res.send(result);
    });

    app.delete("/booking/:email", async (req, res) => {
      const email = req.params.email;
      const query = { email: email };
      const result = await bookingCollection.deleteMany(query);
      res.send(result);
    });

    app.post("/reservation", verifyToken, async (req, res) => {
      const reserve = req.body;
      const result = await reservationCollection.insertOne(reserve);
      res.send(result);
    });
    app.get("/reservation", verifyToken, verifyAdmin, async (req, res) => {
      const result = await reservationCollection.find().toArray();
      res.send(result);
    });
    app.get("/reservation", verifyToken, async (req, res) => {
      const email = req.query.email;
      const query = { email: email };
      const result = await reservationCollection.find(query).toArray();
      res.send(result);
    });

    app.delete(
      "/reservation/:id",
      verifyToken,
      verifyAdmin,
      async (req, res) => {
        const id = req.params.id;
        const query = { _id: new ObjectId(id) };
        const result = await reservationCollection.deleteOne(query);
        res.send(result);
      }
    );

    //payment
    app.post("/create-payment-intent", verifyToken, async (req, res) => {
      const { TotalPrice } = req.body;
      const amount = parseInt(TotalPrice * 100); // Convert to cents
      // Create a payment intent
      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        currency: "usd",
        payment_method_types: ["card"],
      });

      res.send({
        clientSecret: paymentIntent.client_secret,
      });
    });

    app.post("/payment", verifyToken, async (req, res) => {
      const info = req.body;
      const result = await paymentCollection.insertOne(info);
      res.send(result);
    });

    app.get("/payment", async (req, res) => {
      const email = req.query.email; // Correctly access the 'email' query parameter
      if (email) {
        const paymentData = await paymentCollection.find({ email }).toArray();
        return res.json(paymentData);
      } else {
        const allPayment = await paymentCollection.find().toArray();
        return res.json(allPayment);
      }
    });

    // stats
    app.get("/admin-stats", verifyToken, verifyAdmin, async (req, res) => {
      const user = await userCollection.estimatedDocumentCount();
      const placeItems = await placeCollection.estimatedDocumentCount();
      const reservationItems =
        await reservationCollection.estimatedDocumentCount();
      const result = await paymentCollection
        .aggregate([
          {
            $group: {
              _id: null,
              totalRevenue: {
                $sum: "$TotalPrice",
              },
            },
          },
        ])
        .toArray();
      const revenue = result.length > 0 ? result[0].totalRevenue : 0;

      res.send({
        user,
        placeItems,
        reservationItems,
        revenue,
      });
    });

    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

// server running
app.get("/", (req, res) => {
  res.send("Traveling");
});

app.listen(port, () => {
  console.log(`Traveling going on ${port}`);
});
