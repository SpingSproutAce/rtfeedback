
/**
 * Module dependencies.
 */

var express = require('express');

var app = module.exports = express.createServer();

// Configuration

app.configure(function(){
  app.set('views', __dirname + '/views');
  app.set('view engine', 'jade');
  app.use(express.bodyParser());
  app.use(express.methodOverride());
  app.use(express.cookieParser());
  app.use(express.session({ secret: 'let me know who you are' }));
  app.use(app.router);
  app.use(express.static(__dirname + '/public'));
});

app.configure('development', function(){
  app.use(express.errorHandler({ dumpExceptions: true, showStack: true })); 
  app.set('connstring', 'mongodb://localhost/rtfeed-dev')
});

app.configure('production', function(){
  app.use(express.errorHandler());
  app.set('connstring', 'mongodb://localhost/rtfeeed'); 
});

// Routes
app.get('/', function(req, res){
	res.render('index');
});

app.post('/login', function(req, res){
	var email = req.body.email;	
	console.log(email);
	// validate email
	// if it has error, return to the form with the error message.
	req.session.email = email;
	res.redirect('list');
});

app.get('/list', function(req, res){
	// get the presentation list
	res.render('list', {'email':req.session.email});
});

app.get('/p/:id', function(req, res){
	console.log(req.params.id);
	res.render('presentation', {'email':req.session.email, 'p_id':req.params.id});
});

app.listen(3000);
console.log("Express server listening on port %d", app.address().port);
