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

const cfenv = require('cfenv');
const debug = require('debug')('sss-sync');
const express = require('express');
const init = require('./lib/initialize.js');

/*
 *
 */

 	debug('debug is enabled.');

	var appEnv = cfenv.getAppEnv();

	// load service binding for repository database if running locally
	if(appEnv.isLocal) {
		try {
	  		appEnv = cfenv.getAppEnv({vcap: {services: require('./vcap_services.json')}});
		}
		catch(ex) { 
			// ignore 
		}
	}

	debug(JSON.stringify(appEnv));

	console.log('Service is initializing...');

	// initialize application
	init(appEnv, function(err, feed, sssclient) {

		if(err) {
			console.error('Initialization failed: ' + err);
			process.exit(1);
		}

		feed.on('change', function(change) {
			sssclient.throttledSync(change, function(err) {
				if(err) {
					console.log('Simple-search-Service sync failed: ' + err);
				}
				else {
					console.log('Simple-search-Service sync succeeded.');
				}
			});
		});

		feed.on('error', function(err) {
  			console.error('Error monitoring change feed: ' + err);
  			throw ('Error monitoring change feed: ' + err);
		});

		feed.follow();

		var app = express();

		//
		// start server on the specified port and binding host
		//
		app.listen(appEnv.port, '0.0.0.0', function() {
			console.log('Server starting on ' + appEnv.url);
		});
	});

	// send sample application deployment tracking request to https://github.com/IBM-Bluemix/cf-deployment-tracker-service
	//require('cf-deployment-tracker-client').track();
