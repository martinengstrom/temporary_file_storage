# Temporary file storage
A simple to use file uploader that automatically removes files after 30 minutes. It is passwordless by design and requires facebook login instead and authorizes uploads only to those who are friends with [Martin Engström](https://www.facebook.com/martin.engstrom.92)

## Install
You need to make sure that the following folder structure is present:
```
    .
    ├── server.js
    ├── cron.js
    ├── files
    ├── tmp
    ├── static
    └── views
```

Make sure files and tmp are writeable by the node process.
Create a cronjob to clean up the old files, example:
```
    * * * * * node /srv/node/upload/cron.js
```

and finally install the dependencies:
```
    npm install
```

## Usage
You should modify server.js to use your facebook id instead of mine, like so:
```JavaScript
    var XEALOT_USERID = '1020902295'; // Your ID here
```
