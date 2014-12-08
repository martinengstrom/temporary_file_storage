/* Run this file as a service like server.js */

var CronJob = require('cron').CronJob;
var fs = require('fs');
var filesDir = __dirname + '/files/';
var maxAge = 30*60*1000;	// 30 minutes;


new CronJob('* * * * *', function() {
	fs.readdir(filesDir, function(err, files) {
		files.forEach(function (file) {
			fs.stat(filesDir + file, function(err, stats) {
				var age = Date.now() - stats.ctime.getTime();
				if (age >= maxAge) {
					fs.unlinkSync(filesDir + file);
				}
			});
		});
	});
}).start();
