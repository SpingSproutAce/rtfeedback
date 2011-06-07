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

var Comments = new Schema({
	id		:ObjectId,
	from	:String,
	to		:String, 
	body	:String,
	emotion	:String,
	date	:Date
});
mongoose.model("Comments", Comments);

var Comments = exports.Comments = db.model('Comments');