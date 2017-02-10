'use strict';

/*
 * Map change document properties to a Simple-Search-Service data entry
 * @param {object} change couchdb/cloudant change document
 */
const map = function(change) {
	var row = null;
	if(change) {
		// sample change document (see "sample_documents/cheese1.json")
		// change: {
		//           doc: {
		//					"_id": "c00000000001",
		//					"name": "Limburger",
		//					"age": "young",
		//					"texture": "soft",
		//					"flavor": "pungent",
		//					"pairings": "Porter",
		//					"description": "A stinky cheese"
		//			 }
		// }
		//			
		row = {
			cheese: change.doc.name || 'undefined',
			pairings: (change.doc.pairings || []).join(','),
			description: change.doc.description || ''
		};
	}
	return row;
};

module.exports = map;