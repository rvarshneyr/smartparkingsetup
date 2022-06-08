'use strict'

// Run this script with your AWS region as the first parameter
// e.g. node ./setup.js us-east-2

const AWS = require('aws-sdk')
AWS.config.update({ region: process.argv[2] })

const ddb = new AWS.DynamoDB()
const ddbGeo = require('dynamodb-geo')

// Configuring constants
const DDB_TABLENAME = 'parkingmeters'
const config = new ddbGeo.GeoDataManagerConfiguration(ddb, DDB_TABLENAME);


config.hashKeyLength = 5;
config.rangeKeyAttributeName = 'deviceID';

// Use GeoTableUtil to help construct a CreateTableInput.
const createTableInput = ddbGeo.GeoTableUtil.getCreateTableRequest(config)

//createTableInput.AttributeDefinitions[1].AttributeType = 'N'; // RangeKey type change to N

// Tweak the schema as desired
createTableInput.ProvisionedThroughput.ReadCapacityUnits = 2;


console.log('Creating table with schema:')
console.dir(createTableInput, { depth: null })

// Create the table
ddb.createTable(createTableInput).promise()
  // Wait for it to become ready
  .then(function () { return ddb.waitFor('tableExists', { TableName: config.tableName }).promise() })
  .then(function () { console.log('Table created and ready!') })
