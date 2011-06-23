$(function(){
  FB.init({appId: '162946793771514', status: true, cookie: true,xfbml: true,logging:false});
  
  $('a#fbLogin').click(function(e){
    e.preventDefault();
    FB.login(function(response){
      if (response.session) {
        FB.api('/me', function(response) {
          if(response){
            console.log(response);
            $('#loginForm').append($('<input />', {name:'uname',value:response.name,type:"hidden"}))
                           .append($('<input />', {name:'uid',value:response.id,type:"hidden"}))
                           .append($('<input />', {name:'uImg',value:'https://graph.facebook.com/'+response.id+'/picture',type:"hidden"}))
                           .append($('<input />', {name:'uType',value:'facebook',type:"hidden"})).submit();
          }
        });
      }
    });
  });  
});
