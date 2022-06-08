'use strict'
const AWS = require('aws-sdk')
const ddbGeo = require('dynamodb-geo') // Geo library of Amazon DynamoDB
AWS.config.update({ region: "us-east-2" })

// Update GeoDataManagerConfiguration in Geolibrary 
const DDB_TABLENAME = 'parkingmeters';
const ddb = new AWS.DynamoDB();
const config = new ddbGeo.GeoDataManagerConfiguration(ddb, DDB_TABLENAME);
config.rangeKeyAttributeName = 'timestamp';
const myGeoTableManager = new ddbGeo.GeoDataManager(config);

/**
 * @type {import('@types/aws-lambda').APIGatewayProxyHandler}
 */
exports.handler = async (event, context) => {
    let response;
    var results = Array();
    let radius
    let latitude
    let longitude;
    console.log(JSON.stringify(event));
    try {
        
         if (event.queryStringParameters && event.queryStringParameters.radius) {
        console.log("Received radius: " + event.queryStringParameters.radius);
        radius = event.queryStringParameters.radius;
    }
    
        if (event.queryStringParameters && event.queryStringParameters.latitude) {
        console.log("Received latitude: " + event.queryStringParameters.latitude);
        latitude = event.queryStringParameters.latitude;
    }
    
        if (event.queryStringParameters && event.queryStringParameters.longitude) {
        console.log("Received longitude: " + event.queryStringParameters.longitude);
        longitude = event.queryStringParameters.longitude;
    }
    
    
        // Querying 100m from 093 Harris Parkway for any open parking
        await myGeoTableManager.queryRadius({
            RadiusInMeter: parseFloat(radius),
            CenterPoint: {
                latitude: parseFloat(latitude),
                longitude: parseFloat(longitude)
            },
            //ScanIndexFotrward: false,
            //Limit: "1"  //not suported yet by dynamodb-geo lib
        })
                .then(parkings => {
                console.log("number of open slots" + parkings.length.toString());
                parkings.forEach(function (record) {
                    var unmarshalledrecord = AWS.DynamoDB.Converter.unmarshall(record);
                    if (unmarshalledrecord.isOccupied == false) {
                        var unmarshalledlocation = unmarshalledrecord.location.values;
                        var meterdata = {
                            address: unmarshalledrecord.address,
                            number: unmarshalledrecord.number,
                            isOccupied: unmarshalledrecord.isOccupied,
                            location: unmarshalledlocation
                        };
                        if (!results.includes(meterdata)) {
                            results.push(meterdata);
                        }
                    }
                })
                console.log(JSON.stringify(results));
            })

        response = {
            'statusCode': 200,
              headers: {
                "Access-Control-Allow-Headers": "*",
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Methods" : "OPTIONS,POST,GET,PUT"
             },
            'body': JSON.stringify({
                openParkings: results,
            })
        }

    } catch (err) {
        console.log(err);
        return err;
    }
    return response;
};