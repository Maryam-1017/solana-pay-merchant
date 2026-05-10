require('dotenv').config();
var express = require('express');
var path = require('path');
var cookieParser = require('cookie-parser');
var logger = require('morgan');
var cors = require('cors');

var paymentIntentRouter = require('./routes/paymentIntent');
var solanaWebhook = require('./routes/solanaPayWebhook');
var merchantsRouter = require('./routes/merchants');

var app = express();

app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type'],
}));
app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (_req, res) => res.json({ status: 'Solana Pay Backend running' }));

app.use('/api', paymentIntentRouter);
app.use('/api', solanaWebhook);
app.use('/api', merchantsRouter);

// init DB
const db = require('./db');
db.init().catch(err => console.error('DB init error', err));

module.exports = app;
