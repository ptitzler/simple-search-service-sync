//-------------------------------------------------------------------------------
// Copyright IBM Corp. 2016
//
// Licensed under the Apache License, Version 2.0 (the 'License');
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an 'AS IS' BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.
//-------------------------------------------------------------------------------

'use strict';

const debug = require('debug')('sss-synch:init');
const debug_data = require('debug')('sss-synch:init:data');
const follow = require('follow');
const fs = require('fs');
const sssclient = require('./sssclient.js');

/*
 * Initialize repository and load defaults
 * @param {Object} appEnv
 * @param {callback} initCallback
 */
var init = function(appEnv, initCallback) {

	debug('Initializing application');

	if(! process.env.COUCH_DB_URL) {
	    debug_data(JSON.stringify(appEnv));
	    return initCallback('Configuration error. Environment variable COUCH_DB_URL is not set.');
	}

	if(! process.env.SSS_URL) {
	    debug_data(JSON.stringify(appEnv));
	    return initCallback('Configuration error. Environment variable SSS_URL is not set.');
	}

	var options = {
		db: process.env.COUCH_DB_URL,
		include_docs: true
	};

	var feed = new follow.Feed(options);

	var sss = null;

	try {
		// create Simple-Search-Service client
		// optional parameters: SSS_LOCKDOWN_USERNAME and SSS_LOCKDOWN_PASSWORD 
		sss = new sssclient(process.env.SSS_URL, 
							process.env.SSS_LOCKDOWN_USERNAME, 
							process.env.SSS_LOCKDOWN_PASSWORD);

		fs.readFile('config/schema.json', 
			        function(err, schemadef) {
			        	if(err) {
			        		debug('Simple-Search-Service schema definition was not found. Skipping initialization.');
			        		return initCallback(null, feed, sss);
			        	}
						sss.init(schemadef, 
			     				function(err) {
									return initCallback(err, feed, sss);
						});
		});
		
	}
	catch(err) {
		return initCallback(err);
	}	

};

module.exports = init;
