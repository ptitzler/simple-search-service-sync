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

const async = require('async');
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

	console.log('Service has started.');

	const max_queue_length = 25;

	// process changes in the source database one-at-a-time in the order they were received
	const q = async.queue(function(change, asyncCallback) {
		// Use Simple-Search-Service client to apply change to index
		sssclient.throttledSync(change,	function(err) {
									return asyncCallback(err);
								});
	},1);

	var feedpaused = false;

	// invoked when the sync queue is empty
	q.empty = function() {
		if(feedpaused) {
			// resume change feed processing to re-populate the queue
			debug('Simple-Search-Service sync queue is empty. Resuming change feed.');
			feed.resume();
			feedpaused = false;
		}
	};

	// invoked when a document change is reported
	feed.on('change', function(change) {		
		// push change to queue
		q.push(change, function(err) {
			if(err) {
				console.error('Simple-search-Service sync failed: ' + err);
			}
			else {
				debug('Simple-search-Service sync for change succeeded.');
			}
		});

		// if more than <max_queue_length> document changes are held for processing pause the input feed
		if(q.length() > max_queue_length) {
			debug('Simple-Search-Service sync queue has reached limit (' + max_queue_length + '). Pausing change feed.');
			feed.pause();
			feedpaused = true;
		}
	});

	// invoked when a fatal error occurred during change feed monitoring
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
		console.log('Server started.');
	});
});

// send sample application deployment tracking request to https://github.com/IBM-Bluemix/cf-deployment-tracker-service
//require('cf-deployment-tracker-client').track();
