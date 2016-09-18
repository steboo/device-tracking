var express = require('express');
var ss = require('serve-static');
var app = express();
var serve = ss('public', { 'index': false });
app.use(serve);

app.get('/', function (req, res) {
	res.redirect('/device-tracking/index.html');
});

app.listen(21215, function () {
	console.log('Listening');
});
