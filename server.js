var express = require('express');
var exphbs = require('express-handlebars');
var formidable = require('formidable');
var fb = require('fb');
var path = require('path');
var http = require('http');
var fs = require('fs');
var util = require("util");
var async = require("async");


var ERROR_RESPONSES = {
	authnfail : 'Authentication failed',
	authzfail : 'Authorization failed',
	fnameblacklisted : 'Filename blacklisted',
	notfriends : 'Authorization failed. Not friends with Martin',
	extblacklisted : 'Extension blacklisted'
};

var BLACKLISTED_EXTENSIONS = [
	'.htm',
	'.html',
	'.xhtml'
];

// My (Martin Engström) facebook ID will be used if none is specified
var FB_USERID = (process.env.fbuid || '1020902295');

/*
	It seems that formidable does not fetch content-range from the form-data
	A possible hackish solution is to simply append the data to a file when its filename already exists

	NOTE: Very poorly implemented at the moment since if a user tries to upload a file with identical filenames
	then their data gets appended on top of each other
*/


/* Since fs.rename and fs.renameSync doesnt work between partitions/hdds */
function properMove(oldFile, newFile) {
	var exists = fs.existsSync(newFile);

	var is = fs.createReadStream(oldFile);
	var os = null;

	if (exists) 
		os = fs.createWriteStream(newFile, {'flags': 'a'});
	else
		os = fs.createWriteStream(newFile);

	is.pipe(os);
	is.on('end', function() {
		fs.unlinkSync(oldFile);
	});
}

function getFbAccessToken(callback) {
	/* TODO. need to re-do the whole facebook thing */ 
}

function getFbUserID(callback) {
	fb.api('/me', function (res) {
		if (!res || res.error) {
			console.log(!res ? 'error occured' : res.error);
			callback(null);
			return;
		}

		callback(res.id);
		return;
	});
}

function fbCheckFriend(friendID, callback) {
	fb.api('fql', { q: 'SELECT uid2 FROM friend WHERE uid1 = me() AND uid2 = ' + friendID }, function(res) {
		if (!res || res.error) {
			console.log(!res ? 'error occured' : res.error);
			return;
		}

		if (res.data.length > 0) {
			var friendResult = res.data[0].fql_result_set;
			callback(true);
		} else {
			callback(false);
		}
	});
}

function parseContentRange(header) {
	var result = {
		start: 0,
		end: 0,
		total: 0
	};

	if (typeof (header) != "undefined") {
		// Parse format "bytes start-end/total"
		var data = header.split(' ')[1];
		result.start = parseInt((data.split('/')[0]).split('-')[0]);
		result.end = parseInt((data.split('/')[0]).split('-')[1]);
		result.total = parseInt(data.split('/')[1])-1;
	}

	return result;
}

function checkFbAuth(fields, callback) {
	fb.setAccessToken(fields.fbAccessToken);

	getFbUserID(function (userid) {
		if (userid != FB_USERID) {
			fbCheckFriend(FB_USERID, function(result) {
				callback(result);
			});
		} else 
			callback(true);
	});
}

function fixFilenameConflict(filename) {
	var new_filename = filename;

	if (fs.existsSync(filename)) {
		var basename = path.basename(filename, path.extname(filename));
		basename = path.dirname(filename) + "/" + basename + "_" + path.extname(filename);
		new_filename = fixFilenameConflict(basename);
	}

	return new_filename;
}


var app = express();

app.set('views', __dirname + '/views');
app.use(express.static(__dirname + "/static"));
app.use(express.static(__dirname + "/files"));	// uploaded files

app.engine('handlebars', exphbs({defaultLayout: 'main', layoutsDir: __dirname + '/views/'}));
app.set('view engine', 'handlebars');

/* ONLY ENABLE THE NEXT LINE WHEN IN PRODUCTION */
app.enable('view cache');

app.get('/upload', function(req, res) {
	res.write("hello");
	res.end();
});

app.post('/json/filelist', function(req, res) {
	var uploadsDir = __dirname + "/files";
	var files = {};

	fs.readdir(uploadsDir, function(err, _files) {
		async.each(_files, function(file, callback) {
			var _file = file;
			fs.stat(path.join(uploadsDir, file), function(err, stat) {
				var now, age, ageMinutes, ageSeconds, ageStr;
				
				now = new Date().getTime();
				age = (now - (new Date(stat.ctime).getTime()))/1000;

				if (age >= 60) {
					ageMinutes = Math.floor(age/60);
					ageStr = ageMinutes + 'm ';

					if (age%60 > 0) {
						ageSeconds = Math.floor(age%60);
						ageStr = ageStr + ageSeconds + 's';
					}
				} else {
					ageStr = Math.floor(age) + ' s';
				}

				var file = {
					name: _file,
					size: stat.size,
					path: _file,
					age: age,
					ageFormatted: ageStr
				};

				files[_files.indexOf(_file)] = file;

				callback();
			});
		}, function(err) {
			if (err) {
				console.log(err);
				res.status(500);
				res.end();
			} else {
				res.status(200);
				res.write(JSON.stringify({ files: files }));
				res.end();
			}
		});

	});
});


app.post('/upload', function(req, res) {
	var form = new formidable.IncomingForm();
	var json_files = new Array();

	function declineFile(path, name, size, error_message) {
		fs.unlinkSync(path);
		json_files.push({name: name, size: size, error: error_message});
	}

	function uploadComplete() {
		res.status(200);
		res.json({'files': json_files});
		res.end();
	}

	function handleChunk(fields, files, onComplete) {
		checkFbAuth(fields, function(result) {
			if (BLACKLISTED_EXTENSIONS.indexOf(path.extname(files.files.name)) < 0) {
				if (result) {
					onComplete(files);
				} else {
					declineFile(files.files.path, files.files.name, files.files.size, ERROR_RESPONSES.notfriends);
				}
			} else {
				declineFile(files.files.path, files.files.name, files.files.size, ERROR_RESPONSES.extblacklisted);
			}
			uploadComplete();
		});
	}

	form.parse(req, function(err, fields, files) {
		var chunk = parseContentRange(req.headers['content-range']);

		if (chunk.total == 0) {
			handleChunk(fields, files, function(files) {
				var finalName = fixFilenameConflict(__dirname + '/files/' + files.files.name);
				properMove(files.files.path, finalName);
				json_files.push({name: path.basename(finalName), size: files.files.size, error: ''});
			});
		} else {
			if (chunk.start == 0) {
				handleChunk(fields, files, function(files) {
					properMove(files.files.path, __dirname + '/tmp/' + files.files.name);
					json_files.push({name: files.files.name, size: files.files.size, error: ''});
				});
			} else {
				if (chunk.end == chunk.total) {
					handleChunk(fields, files, function(files) {
						properMove(files.files.path, __dirname + '/tmp/' + files.files.name);
						var finalName = fixFilenameConflict(__dirname + '/files/' + files.files.name);
						fs.renameSync(__dirname + '/tmp/' + files.files.name, finalName);
						json_files.push({name: path.basename(finalName), size: files.files.size, error: ''});
					});
				} else {
					/* Mid-piece chunk, append to tmp file */
					properMove(files.files.path, __dirname + '/tmp/' + files.files.name);
					json_files.push({name: files.files.name, size: files.files.size, error: ''});
					uploadComplete();
				}
			}
		}
	});

});


app.get('*', function(req, res) {
	// 404 / catch all - user probably attempted to access a deleted file
	res.render('404', {
		adress: req.originalUrl
	});
});

app.listen(process.env.port || 8007, function() {
	console.log('Uploader listening');
});
