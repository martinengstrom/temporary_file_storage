/* Run this from a cronjob to clean up old files */
// * * * * * wget -q --spider http://localhost/tmp/cron.cleanup.php
var fs = require('fs');
var filesDir = __dirname + '/files/';
var maxAge = 30*60*1000;	// 30 minutes;

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
