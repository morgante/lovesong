var express = require('express')
		, http = require('http')
		, url = require('url');
  // , passport = require('passport')
  // , mongodb = require('mongodb')
  // , mongoose = require('mongoose')
  // , bcrypt = require('bcrypt')
	// , User = require('./models/user')
	// , Portfolio = require('./models/portfolio')
  // , SALT_WORK_FACTOR = 10;
  
// mongoose.connect('localhost', 'fsnew');
// var db = mongoose.connection;
// db.on('error', console.error.bind(console, 'connection error:'));
// db.once('open', function callback() {
//   console.log('Connected to DB');
// });

var app = express();

// configure Express
app.configure(function() {
  app.set('views', __dirname + '/views');
  app.set('view engine', 'ejs');
  app.engine('ejs', require('ejs-locals'));
  app.use(express.logger());
  app.use(express.cookieParser());
  app.use(express.bodyParser());
  app.use(express.methodOverride());
  app.use(express.session({ secret: process.env.SECRET })); // CHANGE THIS SECRET!
  // Initialize Passport!  Also use passport.session() middleware, to support
  // persistent login sessions (recommended).
  // app.use(passport.initialize());
  // app.use(passport.session());
  app.use(app.router);
  app.use(express.static(__dirname + '/public'));
});


app.get('/', function(req, res){
  res.render('index', { user: req.user });
});

app.get('/json', function( req, res ) {
	var options = url.parse(req.url, true);
	options.host = 'api.geckolandmarks.com'
	
	http.get(options, function(response){
	  var str = '';

	  //another chunk of data has been recieved, so append it to `str`
	  response.on('data', function (chunk) {
	    str += chunk;
	  });

	  //the whole response has been recieved, so we just print it out here
	  response.on('end', function () {
	    res.send( str );
	  });
	}).on("error", function(e){
	  console.log("Got error: " + e.message);
	});	
});

app.listen( process.env.PORT , function() {
  console.log('Express server listening on port ' + process.env.PORT);
});