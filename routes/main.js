var models = require('../models')
	, pkg = require('../package.json')
	, music = require('../lib/music')

var _ = require('underscore')

routes = {
	index: function( req, res ) {
		if (req.user != undefined) {
			routes.home(req,res);
		} else {
			routes.landing(req,res);
		}
	},
	home: function(req, res) {
		_.each(req.user.artists, function(artist) {
			music.getSimilar(artist, function(data) {
				console.log(data);
			});
		});
		
		res.render("home", {
			project: pkg.name,
			user: req.user
		});
	},
	landing: function(req, res) {
		res.render("landing", {
			project: pkg.name
		});
	}
}

module.exports = routes;