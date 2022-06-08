'use strict'
// Run this script with your AWS region as the first parameter
// e.g. node ./dataingest.js us-east-2
const AWS = require('aws-sdk')
AWS.config.update({ region: process.argv[2] })
const uuid = require('uuid');
const crypto = require('crypto');
const fs = require('fs');
const ddbGeo = require('dynamodb-geo')
// Configuring constants
const DDB_TABLENAME = 'parkingmeters';
const ddb = new AWS.DynamoDB();
const config = new ddbGeo.GeoDataManagerConfiguration(ddb, DDB_TABLENAME);
config.rangeKeyAttributeName = 'deviceID';
const myGeoTableManager = new ddbGeo.GeoDataManager(config);
//const data = require('./parkingmeters.json')
const startIngestingData = new Promise((resolve, reject) => {
    setTimeout(() => {
        resolve('Done');
    }, 300);
});
startIngestingData
    .then(function () {
        const data = require('./parkingmeters.json');
        console.log("Preparing data before import...");
        // add unique deviceID for combination of meter number, address and location
        data.map(el => {
            var deviceIDStr = el.meter.number.toString() + '-' + el.meter.address + '-' + el.meter.location[0].toString() + '-' + el.meter.location[1];
            var deviceIDHash = crypto.createHash('md5').update(deviceIDStr).digest('hex');
            el.deviceID = deviceIDHash; //add unique device ID
        })
        // Filter the data to get latest timestamp data for devices. Dynamodb will only contain latest device state for efficient query purpose.
        let latestDatawithUniqueID = data.filter(item => {
            return !data.some(item2 =>
                item.deviceID === item2.deviceID && parseInt(item.timestamp.toString()) < parseInt(item2.timestamp.toString()))
        });
        console.log("Data preparation before import is done!");
        console.log('Imporing JSON file data');
        // Enumerate through parking state of each device. Construct UpdatePoint object array to be used latter for batch create latter.
        const updatePointInputs = latestDatawithUniqueID.map(function (parkingslot) {
            return {
                RangeKeyValue: { S: parkingslot.deviceID }, // Use this to ensure uniqueness of the hash/range pairs.
                GeoPoint: {
                    latitude: parkingslot.meter.location[0],
                    longitude: parkingslot.meter.location[1]
                },
                PutItemInput: {
                    Item: {
                        number: { N: parkingslot.meter.number.toString() },
                        address: { S: parkingslot.meter.address },
                        location: { NS: parkingslot.meter.location },
                        isOccupied: { BOOL: parkingslot.isOccupied },
                        timestamp: { N: parkingslot.timestamp.toString() }
                    }
                }
            }
        });

        console.log("total parking slots " + updatePointInputs.length.toString());
		//Create batches of 25 items so we can create item in dynamodb in batch to minimize latency
        const BATCH_SIZE = 25;
        const WAIT_BETWEEN_BATCHES_MS = 1000;
        var currentBatch = 1;
        // This function does batch write of 25 items per batch. It will be called multiple times for each batch of 25 items
        function resumeWriting() {
            if (updatePointInputs.length === 0) {
                return Promise.resolve();
            }
            const thisBatch = [];
            for (var i = 0, itemToAdd = null; i < BATCH_SIZE && (itemToAdd = updatePointInputs.shift()); i++) {
                thisBatch.push(itemToAdd);
            }
            console.log('Writing batch ' + (currentBatch++) + '/' + Math.ceil(data.length / BATCH_SIZE));
            return myGeoTableManager.batchWritePoints(thisBatch).promise()
                .then(function () {
                    return new Promise(function (resolve) {
                        setInterval(resolve, WAIT_BETWEEN_BATCHES_MS);
                    });
                })
                .then(function () {
                    return resumeWriting()
                })
                .catch(err => { console.log(err) });
        }
        return resumeWriting().catch(function (error) {
            console.warn(error);
        });

    })
    .then(function () {
        console.log("uploading file to S3...");
		
		// Upload supplied data in a json file into s3 for recreate purpose if needed latter

        var s3 = new AWS.S3();
        const fileContent = fs.readFileSync('./parkingmeters.json');
        var params = {
            Bucket: 'parkingmeterinitialloaddata',
            Key: 'parkingMeterInitialLoad.json',
            Body: fileContent
        };
        return s3.upload(params).promise()
            .then(function (data) {
                console.log('File Uploaded to S3 successfully.');
            }).catch(function (err) {
                console.log(err);
            });
    })
    .then(function () {
        console.log("Imported Process Completed!!");
        process.exit(0);
    })
    .catch(err => { console.log(err) });
