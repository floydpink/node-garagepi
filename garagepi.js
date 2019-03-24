const path = require('path');
const logger = require('morgan');
const bodyParser = require('body-parser');
const GPIO = require("onoff").Gpio;
const express = require('express');
const app = express();
const server = require('http').Server(app);
const io = require('socket.io')(server);
let startTakingSnaps = false;

require('console-stamp')(console, '[HH:MM:ss]');

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.engine('html', require('ejs').renderFile);

app.use(logger('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(express.static(path.join(__dirname, 'public')));

app.get('/', function(req, res) {
  res.render('index.html');
});

let state = 'closed';
app.get('/api/clickbutton', function(req, res) {
  state = state == 'closed' ? 'open' : 'closed';

  // hardcode to closed for now until reed switch
  state = 'closed';
  res.setHeader('Content-Type', 'application/json');
  res.end(state);
  outputSequence(7, '10', 1000);
});

app.get('/api/status', function(req, res) {
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify({ state: state }));
  console.log('returning state: ' + state);
});

function outputSequence(pin, seq, timeout) {
  const gpio = new GPIO(4, 'out');
  gpioWrite(gpio, pin, seq, timeout);
}

function gpioWrite(gpio, pin, seq, timeout) {
  if (!seq || seq.length <= 0) {
    console.log('closing pin:', pin);
    gpio.unexport();
    return;
  }

  const value = seq.substr(0, 1);
  seq = seq.substr(1);
  setTimeout(function() {
    console.log('gpioWrite, value:', value, ' seq:', seq);
    gpio.writeSync(value);
    gpioWrite(gpio, pin, seq, timeout);
  }, timeout);
}

// catch 404 and forward to error handler
app.use(function(req, res, next) {
  const err = new Error('Not Found');
  err.status = 404;
  next(err);
});

function takeSnaps() {
  return setTimeout(function () {
    const imgPath = path.join(__dirname, 'public/images');
    const cmd = 'raspistill -w 640 -h 480 -q 80 -o ' + imgPath + '/garage.jpg';
    const exec = require('child_process').exec;
    exec(cmd, function (error, stdout, stderr) {
      if (error !== null) {
        console.log('exec error: ' + error);
        return;
      }
      io.emit('snapshot', 'ready');
      console.log('snapshot created...');
      if (startTakingSnaps) {
        takeSnaps();
      }
    });
  }, 0);
}

io.on('connection', function(socket){
  console.log('a user connected');
  startTakingSnaps = true;
  takeSnaps();

  socket.on('disconnect', function(){
    console.log('user disconnected');
    startTakingSnaps = false;
  });
});

const port = process.env.PORT || 8000;
server.listen(port, function() {
  console.log('GaragePi listening on port:', port);
});
