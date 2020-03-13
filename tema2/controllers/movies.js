const mongoDB = require('mongodb').MongoClient;
module.exports = {
    handler: handler
};

function handler(data, callback) {
    //extras is an array with all the other words after /movies
    let extras = data.fullPath.split('/');
    extras.splice(0, 2);
    switch (data.method) {
        case 'get':
            switch (extras.length) {
                case 0:
                    getMovies(data.query, callback);
                    break;
                case 1:
                    if (parseInt(extras[0]))
                        getMovie(parseInt(extras[0]), callback);
                    else noSuchEndpoint(callback);
                    break;
                case 2:
                    if (parseInt(extras[0]) && extras[1] === 'cast')
                        getCast(parseInt(extras[0]), callback);
                    else noSuchEndpoint(callback);
                    break;
                default:
                    noSuchEndpoint(callback);
                    break;
            }
            break;
        case 'post':
            switch (extras.length) {
                case 0:
                    if (!data.body)
                        badRequest("A body must be provided", callback);
                    else postMovie(data.body, callback);
                    break;
                case 1:
                    if (parseInt(extras[0]))
                        if (!data.body)
                            badRequest("A body must be provided", callback);
                        else postMovieWithId(parseInt(extras[0]), data.body, callback);
                    else noSuchEndpoint(callback);
                    break;
                default:
                    noSuchEndpoint(callback);
                    break;
            }
            break;
        case 'put':
            switch (extras.length) {
                case 0:
                    callback(405);
                    break;
                case 1:
                    if (parseInt(extras[0]))
                        if (!data.body)
                            badRequest("A body must be provided", callback);
                        else putMovie(parseInt(extras[0]), data.body, callback);
                    else noSuchEndpoint(callback);
                    break;
                default:
                    noSuchEndpoint(callback);
                    break
            }
            break;
        case 'delete':
            switch (extras.length) {
                case 0:
                    callback(405);
                    break;
                case 1:
                    if (parseInt(extras[0]))
                        deleteMovie(parseInt(extras[0]), callback);
                    else noSuchEndpoint(callback);
                    break;
                default:
                    noSuchEndpoint(callback);
                    break
            }
            break;
        default:
            noSuchEndpoint(callback);
            break;
    }
}

//route : GET '/movies'
function getMovies(query, callback) {
    mongoDB.connect('mongodb://localhost:27017', async function (err, client) {
        if (err) {
            serverError(callback);
            return;
        }
        let db = client.db('tmdb');
        let movies;
        if (query.title) {
            movies = await db.collection('movies').find({'title': {'$regex': query.title, '$options': 'i'}}).toArray();
        } else movies = await db.collection('movies').find().toArray();
        callback(200, movies)
    });
}

//route : GET /movies/{id}
function getMovie(id, callback) {
    mongoDB.connect('mongodb://localhost:27017', async function (err, client) {
        if (err) {
            serverError(callback);
            return;
        }
        let db = client.db('tmdb');
        let movie = await db.collection('movies').findOne({_id: id});
        if (movie) {
            callback(200, movie)
        } else {
            notFound(callback)
        }
    });
}

function getCast(id, callback) {
    mongoDB.connect('mongodb://localhost:27017', async function (err, client) {
        if (err) {
            serverError(callback);
            return;
        }
        let db = client.db('tmdb');
        let found = await db.collection('movies').findOne({_id: id});
        if (!found) {
            notFound(callback);
            return;
        }
        let result = await db.collection('actors').find({movies: id}).toArray();
        for (const actor of result) {
            delete actor.movies;
        }
        callback(200, result)
    });
}

//route : POST /movies
function postMovie(movie, callback) {
    mongoDB.connect('mongodb://localhost:27017', async function (err, client) {
        if (err) {
            serverError(callback);
            return;
        }
        let db = client.db('tmdb');
        if (!movie.title || !movie.poster_url || !movie.overview || !movie.release_Date) {
            badRequest("The body provided is incomplete. Please submit a valid body.", callback);
            return;
        }
        let regex = /^\d{4}[-]\d{2}[-]\d{2}$/;
        if (!movie.release_Date.match(regex)) {
            badRequest("Date format should be either YYYY-MM-DD", callback)
            return;
        }
        let id = await getNextId('movies');
        let strippedMovie = {
            _id: id,
            title: movie.title,
            poster_url: movie.poster_url,
            overview: movie.overview,
            release_Date: movie.release_Date
        };
        db.collection('movies').insert(strippedMovie, function (err) {
            if (err) {
                serverError(callback);
            } else {
                callback(201, {
                    success: true,
                    message: "Movie created",
                    location: `/movies/${strippedMovie._id}`
                })
            }
        });
    });
}

//route : POST /movies/{id}
function postMovieWithId(id, movie, callback) {
    mongoDB.connect('mongodb://localhost:27017', async function (err, client) {
        if (err) {
            serverError(callback);
            return;
        }
        let db = client.db('tmdb');
        if (!movie.title || !movie.poster_url || !movie.overview || !movie.release_Date) {
            badRequest("The body provided is incomplete. Please submit a valid body.", callback);
            return;
        }
        let regex = /^\d{4}[-]\d{2}[-]\d{2}$/;
        if (!movie.release_Date.match(regex)) {
            badRequest("Date format should be either YYYY-MM-DD", callback);
            return;
        }
        let found = await db.collection('movies').findOne({_id: id});
        if (found) {
            callback(409, {
                success: false,
                message: "Resource already exists"
            });
            return;
        }
        let strippedMovie = {
            _id: id,
            title: movie.title,
            poster_url: movie.poster_url,
            overview: movie.overview,
            release_Date: movie.release_Date
        };
        db.collection('movies').insert(strippedMovie, function (err) {
            if (err) {
                serverError(callback);
            } else {
                callback(201, {
                    success: true,
                    message: "Movie created",
                    location: `/movies/${strippedMovie._id}`
                })
            }
        });
    });
}

//route : PUT /movies/{id}
function putMovie(id, movie, callback) {
    mongoDB.connect('mongodb://localhost:27017', async function (err, client) {
        if (err) {
            serverError(callback);
            return;
        }
        let db = client.db('tmdb');
        if (!movie.title || !movie.poster_url || !movie.overview || !movie.release_Date) {
            badRequest("The body provided is incomplete. Please submit a valid body.", callback);
            return;
        }
        let regex = /^\d{4}[-]\d{2}[-]\d{2}$/;
        if (!movie.release_Date.match(regex)) {
            badRequest("Date format should be either YYYY-MM-DD", callback);
            return;
        }
        let found = await db.collection('movies').findOne({_id: id});
        if (!found) {
            notFound(callback);
            return;
        }
        db.collection('movies').updateOne({_id: id}, {
            $set: {
                title: movie.title,
                poster_url: movie.poster_url,
                overview: movie.overview,
                release_Date: movie.release_Date
            }
        }, {upsert: true}, function (err) {
            if (err) {
                serverError(callback);
            } else {
                callback(200, {
                    success: true,
                    message: "Movie updated",
                    location: `/movies/${id}`
                })
            }
        });
    });
}

//route : DELETE /movies/{id}
function deleteMovie(id, callback) {
    mongoDB.connect('mongodb://localhost:27017', async function (err, client) {
        if (err) {
            serverError(callback);
            return;
        }
        let db = client.db('tmdb');
        let result = await db.collection('movies').deleteOne({_id: id});
        //a movie was deleted
        if (result.deletedCount > 0) {
            callback(200)
        } else notFound(callback)
    });
}

/**Shortcut Functions**/
function noSuchEndpoint(callback) {
    callback(400, {
        "message": "No such endpoint"
    })
}

function badRequest(message, callback) {
    callback(400, {
        success: false,
        message: message
    })
}

function notFound(callback) {
    callback(404, {
        success: false,
        message: "Movie not found"
    })
}

function serverError(callback) {
    callback(500, {
        success: false,
        message: "Internal server error"
    })
}

async function getNextId() {
    const client = await mongoDB.connect('mongodb://localhost:27017')
        .catch(err => {
            console.log(err);
        });
    if (!client) {
        return;
    }
    try {
        const db = client.db("tmdb");
        let collection = db.collection('movies');
        let res = await collection.find().sort({_id: -1}).toArray();
        if (res.length > 0) {
            return parseInt(res[0]._id) + 1
        } else return 1

    } catch (err) {
        console.log(err);
    } finally {
        await client.close();
    }
}
