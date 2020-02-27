/**
 * APIs used:
 * theaudiodb -> retrieve an artist album and then a song
 * musixmatch -> retrieve lyrics of a specific song (limit - 2000)
 * icndb.com -> generate random chuck norris jokes, then compute the text to get a random numberg
 */
const url = require('url');
const http = require('http');
const fs = require('fs');
const pug = require('pug');
const request = require('request');

const app = http.createServer((request, response) => {
    let startTime = process.hrtime();
    //the endpoint that was called
    const endpoint = url.parse(request.url, true).path.split('?')[0].replace('/', '');
    //the query string
    const query = url.parse(request.url, true).path.split('?')[1];

    let logs = {};
    logs.request = `${request.method} /${endpoint}`;

    let params;
    if (query) {
        //the query params stored as an object
        params = JSON.parse('{"' + decodeURI(query).replace(/"/g, '\\"').replace(/&/g, '","').replace(/=/g, '":"') + '"}');
        logs.params = params;
    }

    //will either get the required handler or 'not found page'
    let chosenHandler = typeof router[endpoint] !== 'undefined' ? router[endpoint] : handlers.notFound;

    //wait for the callback
    chosenHandler(params, (statusCode, contentType, payload) => {
        let diff = process.hrtime(startTime);
        logs.status = statusCode;
        logs.response = payload;
        logs.time = getTimeInMs(diff);
        if (endpoint !== "metrics")
            log(logs);
        response.writeHead(statusCode, {"Content-Type": contentType});
        response.write(payload);
        response.end();
    });
});

let handlers = {};

handlers.index = function (params, callback) {
    provideFile("home.html", callback);
};

handlers.notFound = function (params, callback) {
    callback(404, 'application/json', JSON.stringify({message: 'No such endpoint'}));
};

handlers.lyrics = async function (params, callback) {

    if (!params || !params.artist) {
        callback(400, 'application/json', JSON.stringify({message: 'Query should contain artist'}));
        return;
    }
    //has all the artist albums
    const finalResponse = {
        posterURL: undefined,
        trackArtist: undefined,
        trackAlbum: undefined,
        trackName: undefined,
        trackLyrics: undefined
    };
    let albumArray = [];
    let tracksArray = [];
    let randomNumber = 0;
    await Promise.all([getAlbumData(params.artist), getRandomNumber()]).then(function (values) {
        albumArray = values[0];
        randomNumber = values[1];
    });
    if (!albumArray) {
        callback(404, 'application/json', JSON.stringify({message: 'Nonexistent artist or he/she has no albums'}));
        return;
    } else {
        randomNumber %= albumArray.length;
    }

    let chosenAlbum = albumArray[randomNumber];
    finalResponse.posterURL = chosenAlbum.strAlbumThumb;

    await Promise.all([getAlbumTracks(chosenAlbum.idAlbum), getRandomNumber()]).then(function (values) {
        tracksArray = values[0];
        randomNumber = values[1] % tracksArray.length;
    });

    const chosenTrack = tracksArray[randomNumber];

    finalResponse.trackArtist = chosenTrack.strArtist;
    finalResponse.trackName = chosenTrack.strTrack;
    finalResponse.trackAlbum = chosenTrack.strAlbum;

    const trackId = await getTrackId(finalResponse.trackName, finalResponse.trackArtist);
    finalResponse.trackLyrics = await getTrackLyrics(trackId);

    if ((params.type === "json")) {
        callback(200, 'application/json', JSON.stringify(finalResponse));
    } else callback(200, 'text/html', getGraphicPage(
        finalResponse.posterURL,
        finalResponse.trackAlbum,
        finalResponse.trackArtist,
        finalResponse.trackName,
        finalResponse.trackLyrics));
};

handlers.batch = async function (params, callback) {
    const BATCH_REQUESTS = 10;
    const BATCH_SIZE = 5;
    let triggers = [];
    for (let i = 0; i < BATCH_REQUESTS; i += BATCH_SIZE) {
        triggers.push(i)
    }
    let totalTime = 0.0;
    let minTime = Number.MAX_SAFE_INTEGER;
    let maxTime = 0.0;
    let finishedRequests = 0;
    setTimeout(loop, 50);

    function loop() {
        if (triggers.length === 0 && finishedRequests === BATCH_REQUESTS) {
            callback(200, 'application/json', JSON.stringify({
                message: `Finished`,
                requests: BATCH_REQUESTS,
                minTime: minTime,
                averageTime: totalTime / BATCH_REQUESTS,
                maxTime: maxTime
            }));
        } else {
            if (triggers.includes(finishedRequests)) {
                triggers.splice(triggers.indexOf(finishedRequests), 1);
                let nrOfReqs = BATCH_SIZE <= (BATCH_REQUESTS - finishedRequests) ? BATCH_SIZE : (BATCH_REQUESTS - finishedRequests);
                runBatch(nrOfReqs, (time) => {
                    totalTime += time;
                    if (time > maxTime)
                        maxTime = time;
                    if (time < minTime)
                        minTime = time;
                    finishedRequests += 1;
                });
            }
            setTimeout(loop, 50);
        }
    }
};

function runBatch(size, callback) {
    for (let i = 1; i <= size; i++) {
        let startTime = process.hrtime();
        http.request({
            host: '127.0.0.1',
            port: 3000,
            path: '/lyrics?artist=hollywood%20undead',
        }, function () {
            let diff = process.hrtime(startTime);
            callback(parseFloat(getTimeInMs(diff)));
        }).end();
    }
}

handlers.metrics = function (params, callback) {
    provideFile("info.log", callback, 'text');
};


async function getRandomNumber() {
    let url = `https://api.adviceslip.com/advice`;
    let response = await createRequest(url);
    try {
        return (response.slip.advice.length);
    } catch (e) {
        log(e.stack, "error");
        return 0;
    }
}

async function getAlbumData(artist) {
    let url = `https://theaudiodb.com/api/v1/json/1/searchalbum.php?s=${artist}`;
    let response = await createRequest(url);
    try {
        return response.album;
    } catch (e) {
        log(e.stack, "error");
        return undefined;
    }
}

async function getAlbumTracks(albumId) {
    let url = `https://theaudiodb.com/api/v1/json/1/track.php?m=${albumId}`;
    let response = await createRequest(url);
    try {
        return response.track;
    } catch (e) {
        log(e.stack, "error");
        return undefined;
    }
}

async function getTrackId(trackName, trackArtist) {
    let url = `http://api.musixmatch.com/ws/1.1/track.search?apikey=ad91ed88bb5395875b45c104e74d4edd&q_track=${trackName}&q_artist=${trackArtist}`;
    let response = await createRequest(url);
    try {
        return response.message.body.track_list[0].track.track_id
    } catch (e) {
        log(e.stack, "error");
        return -1;
    }
}

async function getTrackLyrics(trackId) {
    let url = `http://api.musixmatch.com/ws/1.1/track.lyrics.get?apikey=ad91ed88bb5395875b45c104e74d4edd&track_id=${trackId}`;
    let response = await createRequest(url);
    try {
        return response.message.body.lyrics.lyrics_body
    } catch (e) {
        return "My API couldn't find lyrics... Clearly it's not perfect";
    }
}

router = {
    home: handlers.index,
    lyrics: handlers.lyrics,
    metrics: handlers.metrics,
    batch: handlers.batch
};

app.listen(3000);

/**
 * Here are the helper functions
 */
//helper function to get a pretty time
function getTimeInMs(diff) {
    const NS_PER_SEC = 1e9;
    const MS_PER_NS = 1e-6;
    return ((diff[0] * NS_PER_SEC + diff[1]) * MS_PER_NS).toPrecision(6)
}

//will send the specified file to the server callback
function provideFile(filename, callback, type = 'text/html') {
    fs.readFile(filename, function (err, data) {
        if (err) noFileFound();
        else sendFile(data);
    });

    function sendFile(data) {
        callback(200, type, data);
    }

    function noFileFound() {
        callback(500, 'application/json', {message: "The server has some sort of error"});
    }
}

function log(payload, type = "info") {
    if (type === "error") {
        fs.appendFile("./error.log", payload + '\n', function (err) {
            if (err) {
                return console.log(err);
            }
        });
    } else if (type === "info") {
        fs.readFile('./info.log', function (err, data) {
            let newData;
            if (!data.length) {
                newData = []
            } else {
                newData = JSON.parse(data.toString());
            }
            newData.push(payload);
            fs.writeFile('./info.log', JSON.stringify(newData), function (err) {
                if (err)
                    return console.log(err)
            })
        });
    }
}

function createRequest(url, body) {
    let options = {
        headers: {'content-type': 'application/json'},
        url: url,
    };
    if (body) {
        options.json = body;
    }
    return new Promise(function (resolve, reject) {
        request.get(options, function (error, response, body) {
            if (error) {
                log(error, "error");
                resolve(undefined);
            } else {
                try {
                    if (typeof body === "string") {
                        resolve(JSON.parse(body));
                    } else resolve(body);
                } catch (e) {
                    console.log(body);
                    resolve(undefined);
                }
            }
        });
    });
}

function getGraphicPage(posterPath, album, artist, track, lyrics) {
    return pug.renderFile('lyrics.pug', {
        posterPath: posterPath,
        album: album,
        artist: artist,
        track: track,
        lyrics: lyrics
    });
}
