# simple-search-service-sync

[![Build Status](https://travis-ci.org/ibm-cds-labs/simple-search-service-sync.svg?branch=master)](https://travis-ci.org/ibm-cds-labs/simple-search-service-sync)

Use this service to continuously synchronize the index of a [Simple-Search-Service](https://github.com/ibm-cds-labs/simple-search-service/) instance with the content of a couchDB/Cloudant database.

### Download 

```
$ git clone https://github.com/ptitzler/simple-search-service-sync.git
$ cd simple-search-service-sync
```

### Configure

#### Define the Simple-Search-Service schema

A schema defines the fields, their data types and whether they are indexed for faceted search. Customize `config/schema.json` to describe the data set you would like to make searchable.

Simple example, describing a schema comprising of three fields, two of which will be indexed for search:

```
{ "fields": [
    {
      "name": "cheese",
      "type": "string",
      "facet": true,
      "example": "Brun-uusto"
    },
    {
      "name": "pairings",
      "type": "arrayofstrings",
      "example": "Zinfandel,Merlot",     
      "facet": true
    },    
    {
      "name": "description",
      "type": "string",
      "example": "It's a bread cheese.",
      "facet": false
    }
  ]
}
```

> Supported data types: `string` (_"val"_), `number` (_val_), `arrayofstrings` (_"val1,val2,val3"_) and `boolean` (_true/false_) 


#### Define document property mappings

Whenever the SSS-sync service is notified that a document was inserted or updated a mapping function is invoked. Customize `lib/map.js` to define the mapping between document properties and the fields in the SSS schema.

The following example maps the `name`, `parirings` and `description` properties from the source document to search index fields. 

```
	...
  if(change) {
    // sample change document (see "sample_documents/cheese1.json")
    // change: {
    //           doc: {
    //            "_id": "c00000000001",
    //            "name": "Limburger",
    //            "age": "young",
    //            "texture": "soft",
    //            "flavor": "pungent",
    //            "pairings": ["Porter","Stout"],
    //            "description": "A stinky cheese"
    //       }
    // }
    //      
    row = {
      cheese: change.doc.name || 'undefined',
      pairings: (change.doc.pairings || []).join(','),
      description: change.doc.description || ''
    };
  }
  return row;
	...
```

The mapping output is sent to the Simple-Search-Service, which will update its index accordingly.

### Run

Gather the following information:

* URL of the local or remote source database, e.g.
	```
 https://myuser:mypassword@mycouchdb-host/my-database
	```
* Simple-Search-Service instance URL, e.g. 
	```
 https://my-simple-search-service.mybluemix.net
 	```

* The `SSS_LOCKDOWN_USERNAME` and `SSS_LOCKDOWN_PASSWORD` credentials if `LOCKDOWN` mode is enabled in your Simple-Search-Service instance.

> In the instructions below replace `<COUCH_DB_URL_VALUE>` with the database url `<SSS_URL_VALUE>` with the URL of your Simple-Search-Service instance 


#### Running on Bluemix

Deploy the application and define the required variables:

```
 $ cf push --no-start
 $ cf set-env simple-search-service-sync COUCH_DB_URL <COUCH_DB_URL_VALUE>
 $ cf set-env simple-search-service-sync SSS_URL <SSS_URL_VALUE>
```

Define these variables if `LOCKDOWN` mode is enabled in your Simple-Search-Service instance:
```
 $ cf set-env simple-search-service-sync SSS_LOCKDOWN_USERNAME <SSS_LOCKDOWN_USERNAME_VALUE>
 $ cf set-env simple-search-service-sync SSS_LOCKDOWN_PASSWORD <SSS_LOCKDOWN_PASSWORD_VALUE>
```

Start the application:

```
 $ cf start
```

The application initializes the Simple-Search-Service index and synchronizes it whenever a change in the source database is reported. 

#### Running locally

```
 $ npm install
 $ export COUCH_DB_URL=<COUCH_DB_URL_VALUE>
 $ export SSS_URL=<SSS_URL_VALUE>
 $ export SSS_LOCKDOWN_USERNAME=<SSS_LOCKDOWN_USERNAME_VALUE>
 $ export SSS_LOCKDOWN_PASSWORD=<SSS_LOCKDOWN_PASSWORD_VALUE>
 $ node app
```
