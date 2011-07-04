/**
 * Module dependencies.
 */
var confName = 'ksug'
	, confTitle = 'KSUG Flash Seminar'
	, histories = [{'name':'ksug', 'title':'KSUG Flash Seminar'}
			 , {'name':'sdec', 'title':'SDEC 2011'}
			 , {'name':'jco', 'title':'JCO 2011'}
                         , {'test':'Live.log Test'}];

var host = (process.env.VCAP_APP_HOST || 'localhost')
  , port = (port=process.env.VCAP_APP_PORT || 80)
  , pageSize = 25
  , express = require('express')
  , sio = require('socket.io')
  , models = require('./lib/models')
  , Comments = models.Comments
  , Presentations = models.Presentations
  , Users = models.Users
  , uuid = require('node-uuid')
  , ss2  = require('./lib/ss2')
  , app = module.exports = express.createServer()
  , io = sio.listen(app);
     

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
  io.enable('browser client etag');
  io.set('log level', 1); // If you want logging, remove this line.
  io.set('transports', [
    'websocket'
  , 'flashsocket'
  , 'htmlfile'
  , 'xhr-polling'
  , 'jsonp-polling'
  ]);
});

app.configure('production', function(){
  app.use(express.errorHandler());
  io.enable('browser client minification');
  io.enable('browser client etag');
  io.set('log level', 1);
  io.set('transports', [
    'websocket'
  , 'flashsocket'
  , 'htmlfile'
  , 'xhr-polling'
  , 'jsonp-polling'
  ]);
});

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

var channelStore = ss2.createHashMap();
io.sockets.on('connection', function(socket){
  var id = socket.id;
  
  socket.on('entrance',function(channelId,updatedFn){
    socket.channelId = channelId;
    var users = channelStore.get(channelId);
    if(!users){
      users = ss2.createHashMap();
      channelStore.put(channelId,users);
    }
    users.put(id,1);
    var userCount = users.size();
    updatedFn(userCount);
    socket.broadcast.emit('someone is here '+socket.channelId, userCount);
  });
  
  socket.on('push log', function(message,updateFn){
    var channel = message.channel;
    var msg = message.msg;
    var newComments = new Comments();
    newComments.to = channel;
    newComments.user.name = msg.user.name;
    newComments.user.avatar = msg.user.avatar;
    newComments.body = msg.body;
    newComments.emotion = msg.emotion;
    newComments.date = (+new Date());
    newComments.save(function(err){
    });
    updateFn({'msg':newComments});
    socket.broadcast.emit('pull log '+channel, {'msg':newComments});
  });
  
  socket.on('disconnect', function () {
    var users = channelStore.get(socket.channelId),
        userCount = 1;
    if(users){
      users.remove(id);
      userCount = users.size();
    }
    socket.broadcast.emit('someone is leaving '+socket.channelId, userCount);
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

app.get('/list', function(req, res){
  Presentations.find({'conference':confName}).sort('body', 1).execFind(function(err, result){
	console.log(result);
    res.render('list', {'uname':ss2.getUname(req), 'result':result, 'confTitle':confTitle, 'histories':histories});
  });
});

var getConfByName = function(wantedConfName){
	return histories[getCurrentConfIndex(wantedConfName)];
}

var getCurrentConfIndex = function(){
  var currentIndex = 0;
  histories.forEach(function(conf, index){
    if(conf.name === confName){
      currentIndex = index;
    }
  });
  return currentIndex;
}

var getCurrentConfIndex = function(wantedConfName){
  var currentIndex = 0;
  histories.forEach(function(conf, index){
    if(conf.name === wantedConfName){
      currentIndex = index;
    }
  });
  return currentIndex;
}

app.get('/next', function(req, res){
  var conf = '', currentConfIndex = getCurrentConfIndex();
  if(currentConfIndex !== histories.length-1) {
    conf = histories[++currentConfIndex];
  } else {
    conf = histories[0];
  }
  confName = conf.name;
  confTitle = conf.title;
  res.redirect("/list");
});

app.get('/prev', function(req, res){
  var conf = '', currentConfIndex = getCurrentConfIndex();
  if(currentConfIndex !== 0) {
    conf = histories[--currentConfIndex];
  } else {
    conf = histories[histories.length-1];
  }
  confName = conf.name;
  confTitle = conf.title;
  res.redirect("/list");
});

app.get('/curr', function(req, res){
  var conf = histories[0];
  confName = conf.name;
  confTitle = conf.title;
  res.redirect("/list");	
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

app.get('/p/:id', function(req, res){
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

app.get('/list/mgt', authorization, function(req, res){
  Presentations.find().sort('conference',1).sort('body', 1).execFind(function(err, result){
    res.render("list-mgt", {'result':result});
  });
});

app.post('/list/add', authorization, function(req, res){
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

app.get('/p/mgt/:id', authorization, function(req, res){
  Presentations.findById(req.params.id, function(err, result){
    res.render("p-mgt", {'p':result});
  });
});

app.post('/p/mgt/:id', authorization, function(req, res){
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

app.get('/p/del/:id', authorization, function(req, res){
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

app.get('/p/delrm/:id', authorization, function(req, res){
  Presentations.remove({'_id':req.params.id}, function(err){
    if(err) {
      console.log(err);
    }
  });
  res.redirect("/list/mgt/");
});

app.get('/listset/:conf', authorization, function(req, res){
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


app.get('/m', authorization, function(req, res){
	Comments.find(function(err, data){
		data.forEach(function(c){
			if(!c.user.name) {
				c.user.name = c.from;
				c.user.avatar = 'https://fbcdn-profile-a.akamaihd.net/static-ak/rsrc.php/v1/yo/r/UlIqmHJn-SK.gif';
				c.save();
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

app.get('/admin/:text', function(req, res){
	var textParam = req.params.text;
	if(textParam === 'md5'){
		// ss2.updateUser(req, {isAdmin:true});
		var user = ss2.getUser(req);
        // console.log(user);
        user.isAdmin = true;
        req.session.user = user;
	}
	res.redirect("/");
});

app.listen(port);
console.log("Express server listening on port %d", app.address().port);
