// Boilerplate User Schema
var mongoose = require('mongoose'),
	_ = require('underscore'),
	fbgraph = require('fbgraph'),
	async = require('async')

var Artist = require('./artist');

schema = new mongoose.Schema({
	username: String,
	fbid: {
		type: Number
	},
	displayName: String,
	joined: {
		type: Date,
	    default: Date.now
	},
	
	_picture: {type: String},
	location: {type: mongoose.Schema.Types.Mixed},
	status: String,
	gender: {type: String, default: 'male'},
	interested_in: [String],
	
	externals: {
		type: mongoose.Schema.Types.Mixed,
	    default: {}
	},
	_recommendations: {type: mongoose.Schema.Types.Mixed, default: {}},
	_artists: {
		facebook: [{
			type: mongoose.Schema.Types.ObjectId,
			ref: 'artists'
		}]
	},
	_friends: [{
		type: mongoose.Schema.Types.ObjectId,
		ref: 'users'
	}],
	
	_disliked: [{
		type: mongoose.Schema.Types.ObjectId,
		ref: 'users'
	}]
});

schema.virtual('image').get(function() {
    return 'http://graph.facebook.com/' + this.fbid + '/picture?width=400&height=400';
});

schema.virtual('name').get(function() {
    if (this.displayName != undefined) {
        return this.displayName;
    } else if (this.externals.facebook != undefined) {
		return this.externals.facebook.displayName;
	} else {
		return this.username;
	}
});

schema.virtual('firstName').get(function() {
    return this.name.split(" ")[0];
});

schema.virtual('fbToken').get(function() {
    if (this.externals.facebook == undefined) {
        return false;
    }
    
	return this.externals.facebook.accessToken;
});

schema.virtual('artists').get(function() {
	artists = [];

	_.each(this._artists.facebook, function(artist) {
		artists.push(artist);
	})

	return artists;
});

schema.methods.getFriends = function(cb) {
	var self = this;

	if (this._friends.length == 0 && this.fbToken) {
		fbgraph.setAccessToken(this.fbToken).get("me/friends?fields=id,name,gender,location,relationship_status", function(err, res) {
		    		    		    
			var friends = [];

			async.each(res.data, function(fnd, cb) {
			    			    
				User.modcreate(fnd.id, {
					'displayName': fnd.name,
                    'gender': fnd.gender || 'male',
                    'status': fnd.relationship_status || 'Single',
                    'location': fnd.location
				}, function(err, friend) {
				    				    
					friends.push(friend);
					cb(err);

					// fill in missing data
					if (friend._artists.facebook.length == 0) {
						fbgraph.get(friend.fbid + '/music', function(err, res) {
							if (res.data.length > 0) {
								var artists = [];

								async.each(res.data, function(artist, cb) {
									Artist.modcreate(artist.name, {
										name: artist.name,
										fbid: artist.id
									}, function(err, artist) {
										artists.push(artist._id);
										cb(err);
									});
								}, function(err) {
									friend._artists.facebook = artists;
									friend.save(function(err, n) {})
								});
							}
						});
					}
				});
			}, function(err) {
				self._friends = [];
				_.each(friends, function(friend) {
				    if(friend != undefined ) {
				        self._friends.push(friend._id)
				    }
				});
				self.save(function() {

				});

                if(cb != undefined) {
                    cb(err, friends);
                }
			});

		});
	} else {
		User.find({
			'_id': {
				'$in': self._friends
			}
		}, function(err, friends) {
		    if (cb != undefined) {
		        cb(err, friends);
		    }
		});
	}
}

schema.methods.getMatches = function(opts, cb) {
	artistOpts = opts.artistOpts || {};
	artistOpts.expand = false;
	
	opts.sort = opts.sort || true;
	opts.force = opts.force || false;
	opts.limit = opts.limit || 10000;
		
	var matches = {};
	
	var self = this;
		
	if (opts.force || _.size(self._recommendations) == 0) {
		// first we need all the similar artists
		this.getSimilarArtists(artistOpts, function(err, similarity) {		    
			var artists = _.keys(similarity);
			
			var query = opts.search || {};
			query['_artists.facebook'] = {'$in': artists};
			query['_id'] = {'$ne': self._id};
			query['_id'] = {'$nin': self._disliked};
									
			User.find(query).limit(opts.limit).exec(function(err, users) {
			    
				_.each(users, function(user) {
					var shared = {};
					var score = 0;
					_.each(
						_.intersection(
							_.map(user.artists, function(artist) {
								return artist.toString();
							}),
							artists
						), function(artist) {
							shared[artist] = similarity[artist];
                            // console.log(similarity[artist]);
							score = score + similarity[artist].match;
						}
					);
					
					user._recommendations[self._id] = {
						shared: shared,
						score: score
					};
					user.save(function() {
						
					});
				});

				// if we don't sort, return now
				if( !opts.sort ) {
					cb(err, users);
				}

				// sort the matches
				var users = _.sortBy(users, function(user) {
					return -1 * user._recommendations[self._id].score;
				});

				// we might need to return now
				if (opts.sort) {
					cb(err, users);
				}

				// let's cache this.... FYI THIS IS NOT WORKING
				_.each(users, function(user) {
					self._recommendations[user._id] = user._recommendations[self._id];
				});

				self.save(function(err, d) {
					// console.log('d');
					// console.log(err, d);
				});
			});
		});
	} else {
		
	}
	
}

schema.methods.getArtists = function(cb) {
	Artist.find({
		'_id': {
			'$in': this.artists
		}
	}, function(err, artists) {
		cb(err, artists);
	});
}

schema.methods.getSimilarArtists = function(options, cb) {
	if(typeof(options.injectOwn)==='undefined') options.injectOwn = true;
	if(typeof(options.expand)==='undefined') options.expand = true;
	
	this.getArtists(function(err, myArtists) {
		var similarity = {};

		_.each(myArtists, function(artist) {
			_.each(artist.similar, function(sa) {
				if (similarity[sa.artist] == undefined) {
					similarity[sa.artist] = {
					    match: 0,
					    source: artist
					};
				}
				similarity[sa.artist].match = similarity[sa.artist].match + sa.match;
			});
		});
				
		if (options.expand) {
			Artist.find({
				'_id': {
					'$in': _.keys(similarity)
				}
			}, function(err, artists) {
				_.each(artists, function(artist) {
					artist.match = similarity[artist._id];
				});

				if (options.injectOwn) {
					_.each(myArtists, function(artist) {
						artist.match = 1; // we match 100% with our own artists
						artists.push(artist);
					})
				}

				cb(err, artists);

			});
		} else {		    
            if(options.injectOwn) {
                _.each(myArtists, function(artist) {
                    similarity[artist._id] = {match: 1}; // we match 100% with ourselves
                });
            }
			
			cb(err, similarity);
		}
	});
}

schema.statics.modcreate = function(fbid, properties, cb) {
	User.findOneAndUpdate({
		'fbid': fbid
	}, properties, {
		upsert: true
	}, function(err, user) {
		if (cb != undefined) {
			cb(err, user);
		}
	});
}

var User = module.exports = mongoose.model('users', schema);