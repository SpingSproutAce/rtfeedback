var mongoose = require('mongoose');
var boundServices = process.env.VCAP_SERVICES ? JSON.parse(process.env.VCAP_SERVICES) : null;
var credentials = null;
var db = null;

if (boundServices === null) {
	db = mongoose.connect('mongodb://localhost/rtfeedback');
} else {
	credentials = boundServices['mongodb-1.8'][0]['credentials'];
	db = mongoose.createConnection("mongodb://"
	+ credentials["username"]
	+ ":" + credentials["password"]
	+ "@" + credentials["hostname"]
	+ ":" + credentials["port"]
	+ "/" + credentials["db"]);
}

var Schema = mongoose.Schema,
	ObjectId = Schema.ObjectId;

var Users = new Schema({
	id		:ObjectId,
	name	:String,
	avatar	:String,
	uid		:String,
	uType	:String
});
mongoose.model("Users", Users);
	
var Comments = new Schema({
	id		:ObjectId,
	user    :{
		name    :String,
		avatar    :String
	},
	from	:String,
	to		:String, 
	body	:String,
	emotion	:String,
	date	:Number 
});
mongoose.model("Comments", Comments);

var Presentations = new Schema({
	id		:ObjectId,
	title	:String, 
	speaker	:String,
	body	:String,
	conference:String
});
mongoose.model("Presentations", Presentations);

var Users = exports.Users = db.model('Users');
var Comments = exports.Comments = db.model('Comments');
var Presentations = exports.Presentations = db.model('Presentations');
