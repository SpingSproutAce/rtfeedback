/* HashMap*/
var HashMap = function(_s){   
    this.map = {};
    this._length = 0;
    this.ss2 = _s;
};   
HashMap.prototype = {
  size : function(isPlus){
    if(isPlus === undefined){
      return this._length;
    }
    if(isPlus){
      this._length += 1;
    }else{
      if(this._length){
        this._length -= 1;
      }
    }
    return this;
  },
  put : function(key, value){   
    this.size(true).map[key]= value;
  },   
  get : function(key){   
    return this.map[key];
  },   
  getAll : function(){   
    return this.map;
  },   
  clear : function(){   
    this.map = new Object();
  },   
  getKeys : function(){   
    var keys = new Array();   
    for(i in this.map){   
      keys.push(i);
    }   
    return keys;
  },
  hasKey : function(key){
    return (this.get(key) !== undefined);
  },
  remove : function(key){
    if(this.hasKey(key)){
      delete this.map[key];
      this.size(false);
    }
  },
  isEmpty : function(){
    return this.ss2.isEmptyObject(this.map);
  }
};
module.exports = exports = HashMap;
