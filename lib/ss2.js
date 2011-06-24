var OAuth= require('oauth').OAuth,
    HashMap = require('./hashMap');

var SS2 = (function(){
  var twitterOAuth = new OAuth("https://api.twitter.com/oauth/request_token",
                               "https://api.twitter.com/oauth/access_token",
                               "xzTk6lhfICMywhAWeJwfwA",
                               "iX5hriP5Q3N7rgOHnO92p9hpqLpmi3CZ8srvQaOtrEE",
                               "1.0",
                               null,
                               "HMAC-SHA1");
  var __s = {
  ///*** Is it util? ***///
    isEmptyObject : function(obj){
      for ( var name in obj ) {
        return false;
      }
      return true;
    },

    createHashMap : function(){
      return new HashMap(__s);
    },
    
    isJSONString : function( text ){
      return (/^[\],:{}\s]*$/).test(text.replace(/\\(?:["\\\/bfnrt]|u[0-9a-fA-F]{4})/g, '@')
                                        .replace(/"[^"\\\n\r]*"|true|false|null|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?/g, ']')
                                        .replace(/(?:^|:|,)(?:\s*\[)+/g, '')); 
    },
    
    ///*** be careful! required req or res.!! ***///

    getTwitterLoginUrl : function(req,res,next){ 
      if((__s.isEmptyObject(req.session.twitter)) && __s.isEmptyObject(req.session.user)){
        twitterOAuth.getOAuthRequestToken(function(error, oauth_token, oauth_token_secret, results){
          req.session.twitter={};
          if(!error){ 
            req.session.twitter.twitterLoginUrl = 'https://api.twitter.com/oauth/authenticate?oauth_token='+oauth_token;
          }
          next();
        });
      }else{
        next();
      }
    },

    getTwitterUserInfo : function(req, res, cb){
      twitterOAuth.getOAuthAccessToken(req.query.oauth_token,null,req.query.oauth_verifier,function(error, oauth_access_token,oauth_access_token_secret, results){
        if(!error){
          twitterOAuth.getProtectedResource("https://api.twitter.com/1/account/verify_credentials.json", "GET", oauth_access_token, oauth_access_token_secret,  function (error, data, _res){                        
            if(__s.isJSONString(data)){
              var tUser = JSON.parse(data);
              __s.saveUser(req,res,{'uname':tUser.screen_name,'uid':tUser.id,'avatar':tUser.profile_image_url,'uType':'twitter'})
              cb(true);
            }else{
              cb(false);
            }
          });
        }else{
          cb(false);
        }
      });
    },
    saveUser : function(req,res, data){
      req.session.twitter = {};
      var user = {
        uname   : data.uname,
        uid     : data.uid,
        avatar  : data.avatar,
        uType   : data.uType,
        isAdmin : false
      };
      req.session.user = user;
      res.cookie('ss2user',JSON.stringify(user), {maxAge: 72000000,httpOlny:false});
      return __s;
    },
    
    restoreUserFromCookie : function(req,res,next){
      if(req.cookies.ss2user && __s.isJSONString(req.cookies.ss2user)){
        __s.saveUser(req, res,JSON.parse(req.cookies.ss2user));
        res.redirect('/list');
      }else{
        next();
      }
    },
    
    clearUser : function(req,res){
      req.session.token = undefined;
      req.session.twitter = {};
      req.session.user = {};
      res.clearCookie('ss2user');
      return __s;
    },
    
    getUser : function(req){
      return __s.isEmptyObject(req.session.user)?{}:req.session.user;
    },
    
    getUname : function(req){
      return __s.getUser(req).uname||'Who am I?';
    },
    
    getAvatar : function(req){
      return __s.getUser(req).avatar||'/images/default.png';
    },
    
    isLogin : function(req){
      return !__s.isEmptyObject(__s.getUser(req));
    },
    
    isAdmin : function(req){
      return __s.isLogin(req)?__s.getUser().isAdmin:false;
    }
    
  };
  
  return __s;
})();
module.exports = SS2; 
