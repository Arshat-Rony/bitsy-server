const express = require('express')
const cors = require('cors')
const { MongoClient, ServerApiVersion } = require('mongodb');
require('dotenv').config();
const ObjectId = require('mongodb').ObjectId;
const jwt = require('jsonwebtoken');
const res = require('express/lib/response');
const stripe = require("stripe")('sk_test_51L0mirGh3CcvB5xEdCI8pIWwPt5HdL6rr2YCrSGb2ycw75tFkzXmfk5NVeLbIciAkWzFm82OtoKge9zi7p66StwR003iNIvzNQ')
const app = express()
const port = process.env.PORT || 5000;

// middleware 
app.use(cors())
app.use(express.json())



const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.iceox.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });


// verifyuser by jwt 
async function verifyJWT(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
        return res.status(401).send({ message: "Unauthorized Access" })
    }
    const token = authHeader.split(' ')[1]
    jwt.verify(token, process.env.ACCESS_TOKEN, (error, decoded) => {
        if (error) {
            return res.status(403).send({ message: "Forbidden Access" })
        }
        req.decoded = decoded;
        next()
    })
}



async function run() {
    try {
        await client.connect();
        const database = client.db("bitsy-nft");
        const addedCollection = database.collection("add-products");
        const sellerCollection = database.collection("sellers");
        const productCollection = database.collection('products')
        const userCollection = database.collection('users')




        // fucniton for checking the admin 
        async function verifyAdmin(req, res, next) {
            const requester = req.decoded.email;
            const requesterAccount = await userCollection.findOne({ email: requester })
            if (requesterAccount.role === "admin") {
                next()
            } else {
                res.status(401).send({ message: "Forbidden Access" })
            }
        }




        // get the admin 
        app.get('/users/admin/:email', async (req, res) => {
            const email = req.params.email;
            const result = await userCollection.findOne({ email: email })
            if (result.role === "admin") {
                res.send({ admin: true })
            } else {
                res.send({ admin: false })
            }

        })



        // send all users to server 
        app.put("/users/:email", async (req, res) => {
            const data = req.body;
            const email = req.params.email;
            const filter = { email: email }
            const options = { upsert: true }
            const updateDoc = {
                $set: data,
            }
            const result = await userCollection.updateOne(filter, updateDoc, options)

            const token = jwt.sign({ email: email }, process
                .env.ACCESS_TOKEN, { expiresIn: '1d' })
            console.log(email)

            res.send({ result, token })

        })



        // send client secret for paymnent of any card 
        app.post("/create-payment-intent", verifyJWT, async (req, res) => {
            const product = req.body;
            const price = parseInt(product.price || 1)
            const amount = price * 100;
            //  create paymentIntent with the order amount and currency
            const paymentIntent = await stripe.paymentIntents.create({
                amount: amount,
                currency: "usd",
                payment_method_types: ['card']
            });

            if (paymentIntent.client_secret) {
                res.send({
                    clientSecret: paymentIntent.client_secret,
                })
            }
        })




        // add product to the database
        app.post("/products", async (req, res) => {
            const product = req.body;
            const result = await addedCollection.insertOne(product)
            res.send(result)
        })




        // get all added products
        app.get('/addedProducts/:email', async (req, res) => {
            const email = req.params.email;
            const result = await addedCollection.find({ email }).toArray()
            res.send(result)
        })




        //get all sellers
        app.get("/sellers", async (req, res) => {
            const result = await sellerCollection.find({}).toArray()
            res.send(result)
        })





        //get all products
        app.get("/products", verifyJWT, async (req, res) => {
            const result = await productCollection.find({}).toArray()
            res.send(result)
        })


        // get a single product
        app.get("/product/:id", async (req, res) => {
            const id = req.params.id;
            const query = { _id: ObjectId(id) }
            const result = await productCollection.findOne(query)
            res.send(result)
        })


        // delet the addedProduct
        app.delete("/addedProducts/:id", async (req, res) => {
            const id = req.params.id;
            const filter = { _id: ObjectId(id) }
            const result = await addedCollection.deleteOne(filter)
            res.send(result)
        })




        // update the addedItem 
        app.put("/addedProducts/:id", async (req, res) => {
            const id = req.params.id;
            const filter = { _id: ObjectId(id) }
            const options = { upsert: true }
            const product = req.body;
            const updateDoc = {
                $set: product,
            }
            const result = await addedCollection.updateOne(filter, updateDoc, options)
            res.send(result)
        })





        // get all users 
        app.get("/users", async (req, res) => {
            const result = await userCollection.find({}).toArray()
            res.send(result)
        })






        // make an admin 
        app.put('/admin/:email', verifyJWT, verifyAdmin, async (req, res) => {
            const email = req.params.email;
            const filter = { email: email }
            const options = { upsert: true }
            const updateDoc = {
                $set: { role: "admin" }
            }
            const result = await userCollection.updateOne(filter, updateDoc, options)
            res.send(result)
        })

    }
    finally { }
}

run().catch(console.dir)



app.get('/', (req, res) => {
    res.send("Bitsy Is On Now")
})

app.listen(port, () => {
    console.log("Bitsy")
})