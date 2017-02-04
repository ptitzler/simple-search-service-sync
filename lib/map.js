'use strict';

/*
 * Map change document properties to a Simple-Search-Service data entry
 * @param {object} change couchdb/cloudant change document
 */
const map = function(change) {
	var row = null;
	if(change) {
		row = {
			offering: change.doc.data.offering_id || 'undefined',
			score: change.doc.data.score || 0,
			tags: (change.doc.data.tags || []).join(','),
			comment: change.doc.data.comment || ''
		};
	}
	return row;
};

module.exports = map;