const mongoDB = require('mongodb').MongoClient;
module.exports = {
    handler: handler
};

function handler(data, callback) {
    //extras is an array with all the other words after /actors
    let extras = data.fullPath.split('/');
    extras.splice(0, 2);
    switch (data.method) {
        case 'get':
            switch (extras.length) {
                case 0:
                    getActors(data.query, callback);
                    break;
                case 1:
                    if (parseInt(extras[0]))
                        getActor(parseInt(extras[0]), callback);
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
                    else postActor(data.body, callback);
                    break;
                case 1:
                    if (parseInt(extras[0]))
                        if (!data.body)
                            badRequest("A body must be provided", callback);
                        else postActorWithId(parseInt(extras[0]), data.body, callback);
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
                        else putActor(parseInt(extras[0]), data.body, callback);
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
                        deleteActor(parseInt(extras[0]), callback);
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

//route : GET /actors
function getActors(query, callback) {
    mongoDB.connect('mongodb://localhost:27017', async function (err, client) {
        if (err) {
            serverError(callback);
            return;
        }
        let db = client.db('tmdb');
        let actors;
        if (query.name) {
            actors = await db.collection('actors').find({'name': {'$regex': query.name, '$options': 'i'}}).toArray();
        } else actors = await db.collection('actors').find().toArray();
        callback(200, actors)
    });
}

//route : GET /actors/{id}
function getActor(id, callback) {
    mongoDB.connect('mongodb://localhost:27017', async function (err, client) {
        if (err) {
            serverError(callback);
            return;
        }
        let db = client.db('tmdb');
        let actor = await db.collection('actors').findOne({_id: id});
        if (actor) {
            callback(200, actor)
        } else {
            notFound(callback)
        }
    });
}

//route : POST /actors
function postActor(actor, callback) {
    mongoDB.connect('mongodb://localhost:27017', async function (err, client) {
        if (err) {
            serverError(callback);
            return;
        }
        let db = client.db('tmdb');

        if (!actor.name || !actor.profile_photo || !actor.movies) {
            badRequest("The body provided is incomplete. Please submit a valid body.", callback);
            return;
        }
        let check = await checkMovies(actor.movies, db, callback);
        if (!check) {
            return;
        }
        let id = await getNextId();
        let strippedActor = {
            _id: id,
            name: actor.name,
            profile_photo: actor.profile_photo,
            movies: []
        };
        db.collection('actors').insert(strippedActor, function (err) {
            if (err) {
                serverError(callback);
            } else {
                callback(201, {
                    success: true,
                    message: "Actor created",
                    location: `/actors/${id}`
                })
            }
        });
    });
}

//route : POST /actors/{id}
function postActorWithId(id, actor, callback) {
    mongoDB.connect('mongodb://localhost:27017', async function (err, client) {
        if (err) {
            serverError(callback);
            return;
        }
        let db = client.db('tmdb');

        if (!actor.name || !actor.profile_photo || !actor.movies) {
            badRequest("The body provided is incomplete. Please submit a valid body.", callback);
            return;
        }
        let check = await checkMovies(actor.movies, db, callback);
        if (!check) {
            return;
        }
        let found = await db.collection('actors').findOne({_id: id});
        if (found) {
            callback(409, {
                success: false,
                message: "Resource already exists"
            });
            return;
        }
        let strippedActor = {
            _id: id,
            name: actor.name,
            profile_photo: actor.profile_photo,
            movies: actor.movies
        };
        db.collection('actors').insert(strippedActor, function (err) {
            if (err) {
                serverError(callback);
            } else {
                callback(201, {
                    success: true,
                    message: "Actor created",
                    location: `/actors/${id}`
                })
            }
        });
    });
}

//route : PUT /actors/{id}
function putActor(id, actor, callback) {
    mongoDB.connect('mongodb://localhost:27017', async function (err, client) {
        if (err) {
            serverError(callback);
            return;
        }
        let db = client.db('tmdb');

        if (!actor.name || !actor.profile_photo || !actor.movies) {
            badRequest("The body provided is incomplete. Please submit a valid body.", callback);
            return;
        }
        let check = await checkMovies(actor.movies, db, callback);
        if (!check) {
            return;
        }
        let found = await db.collection('actors').findOne({_id: id});
        if (!found) {
            notFound(callback);
            return;
        }
        db.collection('actors').updateOne({_id: id}, {
            $set: {
                name: actor.name,
                profile_photo: actor.profile_photo,
                movies: actor.movies
            }
        }, {upsert: true}, function (err) {
            if (err) {
                serverError(callback);
            } else {
                callback(200, {
                    success: true,
                    message: "Actor updated",
                    location: `/actors/${id}`
                })
            }
        });
    });
}

//route : DELETE /actors/{id}
function deleteActor(id, callback) {
    mongoDB.connect('mongodb://localhost:27017', async function (err, client) {
        if (err) {
            serverError(callback);
            return;
        }
        let db = client.db('tmdb');
        let result = await db.collection('actors').deleteOne({_id: id});
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
        message: "Actor not found"
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
        let collection = db.collection('actors');
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

async function checkMovies(movies, db, callback) {
    if (!Array.isArray(movies)) {
        badRequest("'movies' should be an array of movie id's", callback);
        return false;
    }
    for (const movie of movies) {
        let movieId = parseInt(movie);
        if (!movieId) {
            badRequest("'movies' should be an array of movie id's", callback);
            return false;
        }
        let found = await db.collection('movies').findOne({_id: movieId});
        if (!found) {
            callback(404, {
                success: false,
                message: "Movie id from 'movies' field not found on server"
            });
            return false;
        }
    }
    return true;
}