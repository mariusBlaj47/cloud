const http = require('http');
const url = require('url');
const PORT = process.env.PORT || 5000;
const StringDecoder = require('string_decoder').StringDecoder;
const movies = require('./controllers/movies');
const actors = require('./controllers/actors');

const server = http.createServer(async function (req, res) {

    let parsedUrl = url.parse(req.url, true);
    // gets the whole route, ex: '/movies/3/cast'
    let trimmedPath = parsedUrl.pathname.replace(/^\/|\/+$/g, '');
    // gets the first word from link
    let endpoint = trimmedPath.split('/')[0].toLowerCase();

    //build the body from the request
    let decoder = new StringDecoder('utf-8');
    let buffer = '';
    req.on('data', function (data) {
        buffer += decoder.write(data);
    });
    req.on('end', function () {
        buffer += decoder.end();
        //pick the handler
        let chosenHandler = typeof router[endpoint] !== 'undefined' ? router[endpoint] : handlers.notFound;
        //send additional data
        let data = {
            "method": req.method.toLowerCase(),
            "fullPath": parsedUrl.pathname.toLowerCase(),
            "query": parsedUrl.query,
            "body": buffer ? JSON.parse(buffer) : undefined
        };
        console.log(data);
        //call the handler
        chosenHandler(data, function (statusCode, payload) {
            statusCode = typeof statusCode === 'number' ? statusCode : 200;
            payload = typeof payload === 'object' ? payload : {};
            let payloadString = JSON.stringify(payload);
            // Send the response
            res.setHeader('Content-Type', 'application/json');
            res.writeHead(statusCode);
            res.end(payloadString);
        });
    });
});

server.listen(PORT, function () {
    console.log('We have a server running on PORT:', PORT);
});

let handlers = {};

handlers.notFound = function (data, callback) {
    callback(400, {
        success: false,
        message: "No such endpoint"
    })
};

let router = {
    movies: movies.handler,
    actors: actors.handler
};
