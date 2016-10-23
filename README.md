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

Install the dependencies:
```
    npm install
```

Make sure ./files and ./tmp are writeable by the node process and start server.js and cron.js with node as normal.
I have included a sample systemd service unit that will run both files using forever.

## Usage
You should modify server.js to use your facebook id instead of mine, like so:
```JavaScript
    var FB_USERID = '1020902295'; // Your ID here
```
alternatively set the environment variable **fbuid** to your ID,
Then simply run **node server.js**

## Example
To see this project running in production please visit:
[http://tmp.sigkill.me/](http://tmp.sigkill.me/)
