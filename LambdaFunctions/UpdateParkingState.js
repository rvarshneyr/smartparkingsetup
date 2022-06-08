'use strict'
const AWS = require('aws-sdk')
const ddbGeo = require('dynamodb-geo') // Geo library of Amazon DynamoDB
AWS.config.update({ region: "us-east-2" })

const uuid = require('uuid');

// Update GeoDataManagerConfiguration in Geolibrary 
const DDB_TABLENAME = 'parkingmeters';
const ddb = new AWS.DynamoDB();
const config = new ddbGeo.GeoDataManagerConfiguration(ddb, DDB_TABLENAME);
config.rangeKeyAttributeName = 'deviceID';

const myGeoTableManager = new ddbGeo.GeoDataManager(config);

exports.handler = async (event) => {
    console.log("Updating DynamoDB with current parking state");

    // Use GeoDataManager geo lib class to update item in DynamoDB. It perform geo hash after insert
    return myGeoTableManager.updatePoint({
        RangeKeyValue: { S: event.deviceID },
        GeoPoint: { // An object specifying latitutde and longitude as plain numbers.
            latitude: event.meter.location[0],
            longitude: event.meter.location[1]
        },
        UpdateItemInput: { // TableName and Key are filled in for you
            UpdateExpression: 'SET isOccupied = :newlyOccupiedValue, #ts =:newtimestamp',
            ExpressionAttributeValues: {
                ':newlyOccupiedValue': { BOOL: event.isOccupied },
                ':newtimestamp': { N: event.timestamp.toString() }
            },
            ExpressionAttributeNames: {
                "#ts": "timestamp"
            }
        }
    }).promise()
        .then(function () {
            console.log('DynamoDB updated successfully by lambda!');

        })
        .catch(err => {
            console.log(err);

        });


};
