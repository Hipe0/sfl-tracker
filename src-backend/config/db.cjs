const { MongoClient } = require('mongodb');
require('dotenv').config();

const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) {
  console.error("CRITICAL: MONGODB_URI is not set in .env");
  process.exit(1);
}
const client = new MongoClient(MONGODB_URI);
let historyCollection;
let usersCollection;
let marketTradesCollection;

async function initDB() {
  try {
    await client.connect();
    const db = client.db('sfl_tracker');
    historyCollection = db.collection('history');
    usersCollection = db.collection('users');
    marketTradesCollection = db.collection('market_trades');
    console.log("Connected to MongoDB successfully!");
  } catch (err) {
    console.error("Failed to connect to MongoDB", err);
    process.exit(1);
  }
}

function getHistoryCollection() {
  return historyCollection;
}

function getUsersCollection() {
  return usersCollection;
}

function getMarketTradesCollection() {
  return marketTradesCollection;
}

module.exports = { initDB, getHistoryCollection, getUsersCollection, getMarketTradesCollection };
