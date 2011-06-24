/**
 * Module dependencies.
 */
const confName = 'sdec';

var express = require('express'),
    io = require('socket.io'),
    models = require('./lib/models'),
    Comments = models.Comments,
    Presentations = models.Presentations,
    uuid = require('node-uuid'),    
    ss2  = require('./lib/ss2');

var app = module.exports = express.createServer();
var socket = io.listen(app);

var host=process.env.VCAP_APP_HOST || 'localhost';
var port=process.env.VCAP_APP_PORT || 11000;
var pageSize = 25;

                      
var authentication = function(req,res,next){
  if(ss2.isLogin(req)){
    next();
  }else{
    res.redirect('/');
  }
};
var authorization = function(req,res,next){
  if(ss2.isAdmin(req)){
    next();
  }else{
    res.redirect('/');
  }  
};
// Configuration
app.configure(function(){
  app.set('views', __dirname + '/views');
  app.set('view engine', 'jade');
  app.use(express.bodyParser());
  app.use(express.methodOverride());
  app.use(express.cookieParser());
  app.use(express.session({ secret: 'let me know who you are','cookie':{'maxAge': 72000000}}));
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

var channelMap = ss2.createHashMap();
var clientKeyMap  = ss2.createHashMap();
var removeClient = function(channalId,sessionId){
  var _clentMap = channelMap.get(channalId||'');
  _clentMap && !_clentMap.isEmpty() && _clentMap.remove(sessionId||'');
};
socket.on('connection', function(client){
  var clientSessionId = client.sessionId;
  client.on('message', function(message){
    var channel = message.channel;
    var action = message.type;
    var msg = message.msg;
    var clientMap = channelMap.get(channel);    
    if(action === 'subscribe'){
      if(clientMap === undefined) {
        clientMap = ss2.createHashMap();
        channelMap.put(channel, clientMap);
      } 
      if(message.sessionId){ 
        removeClient(channel,message.sessionId);
      }
      clientMap.put(clientSessionId,client);
      clientKeyMap.put(clientSessionId,channel);
      
      client.send({'checked':true,'sessionId':clientSessionId,'userCnt':clientMap.size()});
      
    } else if(action === 'publish') {
      // save
      var newComments = new Comments();
      newComments.to = channel;
      newComments.user.name = msg.user.name;
      newComments.user.avatar = msg.user.avatar;
      // newComments.from = msg.from;
      newComments.body = msg.body;
      newComments.emotion = msg.emotion;
      newComments.date = (+new Date());
      newComments.save(function(err){
        // console.log(err);
      });
      // publish
      var clients = channelMap.get(channel).getAll();
      var userCnt = clientMap.size();
      for(var sessionId in clients) {
        clientMap.get(sessionId).send({'msg':newComments,'sessionId':sessionId,'userCnt':userCnt});
      }
    }
  });
  client.on('disconnect', function(){
    removeClient(clientKeyMap.get(clientSessionId),clientSessionId);
    clientKeyMap.remove(clientSessionId);
  });
});

// Routes
app.get('/',ss2.restoreUserFromCookie,ss2.getTwitterLoginUrl, function(req, res){
  if(ss2.isLogin(req)) {
    res.redirect('list');
  } else {
    req.session.token = uuid();
    res.render('index',{'token':req.session.token,'twitterLoginUrl':(req.session.twitter.twitterLoginUrl||'#')});
  }
});

app.post('/login', function(req, res){
  if(!ss2.isLogin(req) && (req.session.token === req.session.token) && req.body.uname ){
    ss2.clearUser(req,res).saveUser(req,res, req.body);
    res.redirect('list');
  } else {
    res.redirect('/');
  }
});

app.get('/logout', authentication,function(req, res){
  ss2.clearUser(req,res);
  res.redirect('/');
});

app.get('/list', authentication,function(req, res){
  // get the presentation list
  Presentations.find({'conference':confName}).sort('body', 1).execFind(function(err, result){
    res.render('list', {'uname':ss2.getUname(req), 'result':result});
  });
});

app.get('/comments', function(req, res){
  res.contentType('application/json');
  if(req.query.date){
     req.query.date = {$lt: req.query.date};
  }

  Comments.find(req.query, ['emotion','body','date','user']).sort('date', -1).limit(pageSize).execFind( function(err, docs) {
    res.send(docs);
  });
});

app.get('/p/:id', authentication, function(req, res){
  var params = {'port':port, 
                'uname':ss2.getUname(req), 
                'avatar':ss2.getAvatar(req),
                'p_id':req.params.id, 
                'title':'',
                'ngCnt'   : 0,
                'goodCnt' : 0, 
                'askCnt'  : 0, 
                'allCnt'  : 0,
                'userCnt' : 0,
                'ngPageCnt'   : 0,
                'goodPageCnt' : 0, 
                'askPageCnt'  : 0, 
                'allPageCnt'  : 0,
                'allUserCnt'  : 0,
                'allUsers'    :''
               },
    presentFn = function(){
      Presentations.findById(req.params.id, function(err, p){
        if(!p){
          res.redirect('/list');
        } else {
          var _clientMap = channelMap.get(req.params.id);
          params['userCnt'] = (_clientMap && !_clientMap.isEmpty() && _clientMap.size()||1)||1;
          params.title = p.title;
          params.serverTime = (+new Date());
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
        params[arg.countNm+'Cnt'] = count;
        params[arg.countNm+'PageCnt'] = Math.ceil((count-pageSize)/pageSize);
        arg.callBack.call(this,args);
      });
    },
    countUserFn = function(args){
    var arg = args[idx++],
  		  param = {'to':params.p_id};
		Comments.collection.distinct('user', param, function(err, data){
		  params['allUsers'] = data;
		  params['allUsersCnt'] = data.length;
		  arg.callBack.call(this,args);
		});
  },
  functions  = [{'callBack':countFn},
                {'emotion' : '!Good', 'countNm' : 'ng', 'callBack' :countFn},
                {'emotion' : 'Good', 'countNm' : 'good', 'callBack' :countFn},
                {'emotion' : 'Ask', 'countNm' : 'ask', 'callBack' :countFn},
                {'countNm' : 'all', 'callBack' :presentFn}
               ],
  idx = 0;
  countUserFn(functions);
});

app.get('/list/mgt', function(req, res){
  Presentations.find().sort('conference',1).sort('body', 1).execFind(function(err, result){
    res.render("list-mgt", {'result':result});
  });
});

app.post('/list/add', function(req, res){
  var presentation = new Presentations();
  presentation.title = req.body.title;
  presentation.speaker = req.body.speaker;
  presentation.body = req.body.body;
  presentation.conference = req.body.conference;
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
	  p.conference = req.body.conference;
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

app.get('/listset/:conf', function(req, res){
	var confName = req.params.conf;
	Presentations.find(function(err, data){
		data.forEach(function(p){
			if(!p.conference) {
				p.conference = confName;
				p.save();
			}
		})
	});
	res.redirect("/list");
});


app.get('/m', function(req, res){
	Comments.find(function(err, data){
		data.forEach(function(c){
			if(!c.user.name) {
				c.user.name = c.from;
				c.user.avatar = 'https://fbcdn-profile-a.akamaihd.net/static-ak/rsrc.php/v1/yo/r/UlIqmHJn-SK.gif';
				c.save();
				console.log(c.user.name);
			}
		});
		res.redirect("/list");
	});
});

app.get('/twitter_callback',function(req,res){
  req.session.twitter={};
  var renderFn = function(isSuccess){res.render("twitter-callback",{layout:false,'isSuccess':isSuccess});};
  if(req.query.denied){
    renderFn(false);        
  }else{
    ss2.getTwitterUserInfo(req,res,function(isSuccess){
      renderFn(isSuccess);        
    });
  }
});
app.listen(port);
console.log("Express server listening on port %d", app.address().port);
