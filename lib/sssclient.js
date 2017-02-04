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

const debug = require('debug')('sss-sync:sync');
const debug_data = require('debug')('sss-sync:sync:data');
const request = require('request');
const RateLimiter = require('limiter').RateLimiter;

const mapChange = require('./map.js');

/*
 * Use this client to apply doc changes (insert/update/delete) from a couchdb/Cloudant
 * database in a Simple-Search-Service index. Design document changes are ignored.
 * 
 * @constructor
 * @param {string} sss_url Simple-Search-Service instance URL; required
 * @param {string} sss_user Simple-Search-Service user name; optional
 * @param {string} sss_password Simple-Search-Service user name; optional
 */
var sssclient = function(sss_url, sss_user, sss_password) {

	if(! sss_url) {
	    throw ('Parameter sssurl is invalid.');
	}

	var sss_base_url = sss_url;
	var sss_auth = ((sss_user) && (sss_password)) ? {user: sss_user,pass: sss_password} : null;

	// limits requests to n per m (e.g. 1 per 100ms)
	const limiter = new RateLimiter(1, 100);

  	var sync = function(change, callback) {

		debug_data('Synch input: ' + JSON.stringify(change));

		if(change.id.startsWith('_design/')) {
			// skip design documents
			debug('Skipping document with id ' + change.id);
			return callback();
		}

		var sss_request_options = {};
		// set authorization header 
		sss_request_options.auth = sss_auth;

		if(change.deleted) {
			sss_request_options.url = sss_base_url + '/row/' + change.id;
			sss_request_options.method = 'DELETE';
			debug_data('DELETE synch request: ' + JSON.stringify(sss_request_options));
		  	request(sss_request_options, 
		   			function(err, response, body) {
		   				debug_data('Synch response: ' + JSON.stringify(response));
	   					if((err) || ((response.statusCode !== 200) && (response.statusCode !== 404))){
	   						var msg = err || body;
		   					return callback('Error synching DELETE for document with id ' + change.id + ': ' + msg);				
		   				}					   				
					return callback();
		   	});	
		}
		else {
			try {
				// map document properties to a Simple-Search-Service data entry
				sss_request_options.form = mapChange(change);
				// re-use the original document's id to support subsequent UPDATE/DELETE requests
				sss_request_options.form._id = change.id;
			}
			catch(ex) {
				return callback('Error mapping change: ' + ex);
			}

			if(change.doc._rev.startsWith('1-')) {
				// first document revision - this is an INSERT operation
				sss_request_options.url = sss_base_url + '/row';
				sss_request_options.method = 'POST';	
				debug_data('INSERT synch request: ' + JSON.stringify(sss_request_options));
			  	request(sss_request_options, 
			   			function(err, response, body) {
			   				debug_data('Synch response: ' + JSON.stringify(response) + ' err: ' + JSON.stringify(err));	   	
		   					if((err) || (response.statusCode >= 300)){
		   						var msg = err || body;		   									
			   					return callback('Error synching INSERT for document with id ' + change.id + ': ' + msg);				
			   				}
			   				else {			   					
								return callback();
							}
			   	});	
			} else {
				// n-th document revision - this is likely an UPDATE operation
				sss_request_options.url = sss_base_url + '/row/' + change.id;
				sss_request_options.method = 'PUT';
				debug_data('UPDATE synch request: ' + JSON.stringify(sss_request_options));
			  	request(sss_request_options, 
			   			function(err, response, body) {
			   				debug_data('Synch response: ' + JSON.stringify(response) + ' err: ' + JSON.stringify(err));
		   					if((err) || (response.statusCode >= 300)){
		   						if(response.statusCode === 404) {
		   							// update failed; try INSERT
									sss_request_options.url = sss_base_url + '/row';
									sss_request_options.method = 'POST';
									debug_data('UPDATE synch request failed. Trying INSERT: ' + JSON.stringify(sss_request_options));	   							
								  	request(sss_request_options, 
								   			function(err, response, body) {
								   				debug_data('Synch response: ' + JSON.stringify(response));	   	
							   					if((err) || (response.statusCode >= 300)){
							   						var msg = err || body;		   									
								   					return callback('Error synching INSERT for document with id ' + change.id + ': ' + msg);				
								   				}
												return callback();
								   	});	
		   						}
		   						else {
		   							var msg = err || body;		   									
			   						return callback('Error synching UPDATE for document with id ' + change.id + ': ' + msg);				
			   					}
			   				}
			   				else {
								return callback();
							}
			   	}.bind(this));					
			}
		}
  	};

	/*
	 * Apply source change to the Simple-Search-Service index
	 * @param {object} change a CouchDB/Cloudant change document
	 * @param {callback} syncCallback invoked with optional error parameter after an attempt was made to apply the change.
	 * 
	 */
  	this.sync = function(change, syncCallback) {
		if(! syncCallback) {
			syncCallback = console.error;
		}

		sync(change, function(err) {
			return syncCallback(err);
		});
  	};	

	/*
	 * Apply source change to the Simple-Search-Service index. Synchronization requests are limited to 1/100ms.
	 * @param {object} change a CouchDB/Cloudant change document
	 * @param {callback} syncCallback invoked with optional error parameter after an attempt was made to apply the change.
	 * 
	 */
  	this.throttledSync = function(change, syncCallback) {
		if(! syncCallback) {
			syncCallback = console.error;
		}

		limiter.removeTokens(1, function() {
			sync(change, function(err) {
				return syncCallback(err);
			});
		});	
  	};

	/*
	 * Initialize the Simple-Search-Service index: drop data and define schema
	 * @param {object} schemadef the schema definition
	 * @param {callback} initCallback invoked with optional error parameter after an attempt was made to initialize the index
	 * 
	 */
  	this.init = function(schemadef, initCallback) {

  		if(! initCallback) {
  			initCallback = console.error;
  		}

  		if(! schemadef) {
  			return initCallback('Cannot initialize Simple-Search-Service index: schema definition is missing.');
  		}

  		debug('Initializing Simple-Search-Service index...');
  		debug_data('Schema definition: ' + JSON.stringify(schemadef));

		var sss_request_options = {
			url : sss_base_url + '/initialize',
			method : 'POST',
			form: {schema: schemadef},
			auth: sss_auth
		};

  		request(sss_request_options, 
	   			function(err, response, body) {
	   				debug_data('Init response: ' + JSON.stringify(response));
   					if((err) || (response.statusCode !== 200)){
   						var msg = err || body;
	   					return initCallback('Error initializing Simple-Search-Service index: ' + msg);				
	   				}
	   				else {
	   					debug('Simple-Search-Service index was initialized.');
						return initCallback();
					}
		});	
  	};	
};

module.exports = sssclient;