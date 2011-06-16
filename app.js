/**
 * Module dependencies.
 */

var express = require('express'),
	io = require('socket.io'),
	models = require('./lib/models'),
	Comments = models.Comments,
	Presentations = models.Presentations;

var app = module.exports = express.createServer();

var socket = io.listen(app);

var host=process.env.VCAP_APP_HOST || 'localhost';
var port=process.env.VCAP_APP_PORT || 11000;

// HashMap
var HashMap = function(){   
    this.map = new Array();
};   
HashMap.prototype = {   
    put : function(key, value){   
        this.map[key] = value;
    },   
    get : function(key){   
        return this.map[key];
    },   
    getAll : function(){   
        return this.map;
    },   
    clear : function(){   
        this.map = new Array();
    },   
    getKeys : function(){   
        var keys = new Array();   
        for(i in this.map){   
            keys.push(i);
        }   
        return keys;
    }
};

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
});

app.configure('production', function(){
  app.use(express.errorHandler());
});

// Socket IO

var channelMap = new HashMap();
socket.on('connection', function(client){
	var clientSessionId = client.sessionId;
	client.on('message', function(message){
		console.log(message);
		
		var channel = message.channel;
		var action = message.type;
		var msg = message.msg;
		if(action === 'subscribe'){
			var clientList = channelMap.get(channel);
			if(!clientList) {
				// console.log("empty");
				var clientList = new Array();
				clientList[clientSessionId] = client;
				channelMap.put(channel, clientList);
			} else {
				clientList[clientSessionId] = client;
			}
			console.log(clientList[clientSessionId] === client);
		} else if(action === 'publish') {
			// save
			var newComments = new Comments();
			newComments.to = channel;
			newComments.from = msg.from;
			newComments.body = msg.body;
			newComments.emotion = msg.emotion;
			newComments.date = (+new Date());
			newComments.save(function(err){
				//console.log(err);
			});
			
			// publish
			var clientList = channelMap.get(channel);
			for(var i in clientList) {
				clientList[i].send({'msg':newComments});
			}
		}		
	});
	client.on('disconnection', function(){
		
	});
});

// Routes
app.get('/', function(req, res){
	if(req.session.username) {
		res.redirect('list');
	} else {
		res.render('index');
	}
});

app.post('/login', function(req, res){
	var username = req.body.username;	
	if(!username){
		res.render('index', {'error':'입력해주시옵소서...'});
	} else {
		req.session.username = username;
		res.redirect('list');
	}
});

app.get('/list', function(req, res){
	if(!req.session.username) {
		res.redirect('/');		
	} else {
		// get the presentation list
		Presentations.find(function(err, result){
			res.render('list', {'username':req.session.username, 'result':result});
		});
	}
});

app.get('/comments', function(req, res){
	res.contentType('application/json');
	var commentList = Comments.find(req.query,function(err, docs){
		res.send(docs);
	});
});

app.get('/p/:id', function(req, res){
	if(!req.session.username) {
		res.redirect('/');		
	} else {
		var params = {'port':port, 
		              'username':req.session.username, 
		              'p_id':req.params.id, 
		              'title':'',
		              'ngCnt'    : 0,
		              'goodCnt'  : 0, 
		              'askCount' : 0, 
		              'allCount' : 0
		             },
			presentFn = function(){
				Presentations.findById(req.params.id, function(err, p){
					if(!p){
						res.redirect('/list');
					} else {
						params.title = p.title;
						res.render('presentation',params);
					}
				});
			},
			countFn = function(args){
				var arg = args[idx++],
					param = {'to':params.p_id};
				if(arg.emotion){
					param.emotion = arg.emotion;
				}
				Comments.find(param).count(function(err, count){
					params[arg.countNm] = count;
					arg.callBack.call(this,args);
				});
			},
			functions  = [{'emotion' : '!Good', 'countNm' : 'ngCnt', 'callBack' :countFn},
						  {'emotion' : 'Good', 'countNm' : 'goodCnt', 'callBack' :countFn},
						  {'emotion' : 'Ask', 'countNm' : 'askCnt', 'callBack' :countFn},
						  {'countNm' : 'allCnt', 'callBack' :presentFn}
						 ],
			idx = 0;
			countFn(functions);
	}
});

app.get('/list/mgt', function(req, res){
	Presentations.find(function(err, result){
		console.log(result);
		res.render("list-mgt", {'result':result});
	});
});

app.post('/list/add', function(req, res){
	console.log(req.body);
	var presentation = new Presentations();
	presentation.title = req.body.title;
	presentation.speaker = req.body.speaker;
	presentation.body = req.body.body;
	presentation.save(function(err){
		// console.log(err);
	});
	res.redirect("/list/mgt");
});

app.get('/p/mgt/:id', function(req, res){
	Presentations.findById(req.params.id, function(err, result){
		res.render("p-mgt", {'p':result});
	});
});

app.post('/p/mgt/:id', function(req, res){
	Presentations.findById(req.params.id, function(err, p){
		if(!p) {
			res.render("p-mgt", {'p':result});
		} else {
			p.title = req.body.title;
			p.speaker = req.body.speaker;
			p.body = req.body.body;
			p.save(function(err) {
				if (err)
					console.log('error')
					res.redirect("/p/mgt/" + req.params.id);
	    	});
		}
	});
});

app.get('/p/del/:id', function(req, res){
	Comments.find({'to':req.params.id}).count(function(err, count){
		if(count === 0) {
			Presentations.remove({'_id':req.params.id}, function(err){
				if(err)
					console.log(err);
			});
		}
		res.redirect("/list/mgt/");
	});
});

app.get('/p/delrm/:id', function(req, res){
	Presentations.remove({'_id':req.params.id}, function(err){
		if(err) {
			console.log(err);
		}
	});
	res.redirect("/list/mgt/");
});



app.listen(port);
console.log("Express server listening on port %d", app.address().port);
