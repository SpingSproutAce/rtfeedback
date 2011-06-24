$(function(){
  var openPopup = function(argOpts){
    var leftPosition = 0, topPosition = 0, opts = argOpts || {}, option;
    if (!opts.width || !opts.height || !opts.url) {
      return false;
    }
    
    if (opts.center) {
      if (screen.width > opts.width) {
        leftPosition = (screen.width) ? (screen.width - opts.width) / 2 : 100;
        topPosition = (screen.height) ? (screen.height - opts.height) / 2 : 100;
      }
    }
    option = 'width=' + (opts.width) + ',height=' + (opts.height) + ',top=' + (topPosition) + ',left=' + (leftPosition) + ',toolbar=no,status=no,resizable=no,scrollbars=yes';
    return window.open(opts.url, '', option);
  };
  
  FB.init({appId: '162946793771514', status: true, cookie: true,xfbml: true,logging:false});
  
  $('a#fbLogin').click(function(e){
    e.preventDefault();
    FB.login(function(response){
      if (response.session) {
        FB.api('/me', function(response) {
          if(response){
            // console.log(response);
            $('#loginForm').append($('<input />', {name:'uname',value:response.name,type:"hidden"}))
                           .append($('<input />', {name:'uid',value:response.id,type:"hidden"}))
                           .append($('<input />', {name:'avatar',value:'https://graph.facebook.com/'+response.id+'/picture',type:"hidden"}))
                           .append($('<input />', {name:'uType',value:'facebook',type:"hidden"})).submit();
          }
        });
      }
    });
  });  
  
  $('a#twLogin').click(function(e){
    e.preventDefault();
    openPopup({'url': $(this).attr('href'),
               'title': 'connect-with-twitter',
               'center': true,
               'width': 800,
              'height': 435});
  });  
});
