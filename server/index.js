const express = require("express"),
	bodyParser = require("body-parser"),
	cors = require("cors"),
	{ Pool } = require("pg"),
	redis = require("redis"),
	keys = require("./keys");

const app = express();
app.use(cors());
app.use(bodyParser.json());

const pgClient = new Pool({
	user: keys.pgUser,
	host: keys.pgHost,
	port: keys.pgPort,
	database: keys.pgDatabase,
	password: keys.pgPassword
});

pgClient.on("error", () => console.log("Lost PG connection"));

pgClient
	.query("CREATE TABLE IF NOT EXISTS values (number INT)")
	.catch((err) => console.log(err.message));

const redisClient = redis.createClient({
	host: keys.redisHost,
	port: keys.redisPort,
	retry_strategy: () => 1000
});

const redisPublisher = redisClient.duplicate();

app.get("/", (req, res) => {
	res.send("Hi");
});

app.get("/values/all", async (req, res) => {
	const values = await pgClient.query("SELECT * from values");
	res.send(values.rows);
});

app.get("/values/current", async (req, res) => {
	redisClient.hgetall("values", (err, values) => {
		res.send(values);
	});
});

app.post("/values", async (req, res) => {
	const { index } = req.body;

	if (parseInt(index) > 40) return res.status(422).send("Index too high!");

	redisClient.hset("values", index, "Nothing yet!");
	redisPublisher.publish("insert", index);
	pgClient.query("INSERT INTO values(number) VALUES($1)", [index]);
	res.send({ working: true });
});

app.listen(5000, (err) => {
	console.log("Listening on 5000");
});
