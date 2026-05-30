require('dotenv').config();
var express = require('express');
var path = require('path');
var cookieParser = require('cookie-parser');
var logger = require('morgan');
var cors = require('cors');

var paymentIntentRouter = require('./routes/paymentIntent');
var solanaWebhook = require('./routes/solanaPayWebhook');
var merchantsRouter = require('./routes/merchants');
var bridgeRouter = require('./routes/bridge');

var app = express();

// Accept comma-separated origins from env, with Vercel + localhost as defaults
const ALLOWED_ORIGINS = (
  process.env.FRONTEND_URL ||
  'http://localhost:3000,https://solana-pay-merchant.vercel.app'
).split(',').map(o => o.trim());

app.use(cors({
  origin: (origin, cb) => {
    // Allow requests with no origin (Railway health checks, curl, Postman)
    if (!origin || ALLOWED_ORIGINS.includes(origin)) return cb(null, true);
    cb(new Error(`CORS: origin ${origin} not allowed`));
  },
  methods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type'],
}));
app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (_req, res) => res.json({ status: 'Solana Pay Backend running' }));

app.get('/api/health', (_req, res) => {
  const db = require('./db');
  res.json({ status: 'ok', db: db.dbAvailable() ? 'connected' : 'unavailable' });
});

app.use('/api', paymentIntentRouter);
app.use('/api', solanaWebhook);
app.use('/api', merchantsRouter);
app.use('/api', bridgeRouter);

// init DB
const db = require('./db');
db.init().catch(err => console.error('DB init error', err));

module.exports = app;
