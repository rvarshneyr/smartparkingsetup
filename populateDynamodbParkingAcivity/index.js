'use strict'
// Run this script with your AWS region as the first parameter
// e.g. node ./index.js us-east-2
const AWS = require('aws-sdk')
const crypto = require('crypto');
AWS.config.update({ region: process.argv[2] })
// Create DynamoDB service object
var ddb = new AWS.DynamoDB({ apiVersion: '2012-08-10' });
//Create promise object so we can write to dynamodb asynchronously
const populateHistoricalData = new Promise((resolve, reject) => {
    setTimeout(() => {
        resolve('Done');
    }, 300);
});
const data = require('./parkingmeters.json');
populateHistoricalData
    .then(function () {

        // add unique deviceID for combination of meter number, address and location
        let datawithUniqueID = data.map(el => {
            var deviceIDStr = el.meter.number.toString() + '-' + el.meter.address + '-' + el.meter.location[0].toString() + '-' + el.meter.location[1];
            var deviceIDHash = crypto.createHash('md5').update(deviceIDStr).digest('hex');
            el.deviceID = deviceIDHash; //add unique device ID
        })
        let putItemRequestArray = [];
        const createItems = data.map(function (parkingslot) {
            return {
                PutRequest: {
                    Item: {
                        "deviceID": { "S": parkingslot.deviceID },
                        "timestamp": { "N": parkingslot.timestamp.toString() },
                        "isOccupied": { "BOOL": parkingslot.isOccupied }
                    }
                }
            }
        });
        console.log("total parking slots " + createItems.length.toString());
        const BATCH_SIZE = 25;
        const WAIT_BETWEEN_BATCHES_MS = 1000;
        var currentBatch = 1;
        // Function that will create batch of 25 items out of total and write them to dynamodb
        function resumeWriting() {
            if (createItems.length === 0) {
                return Promise.resolve();
            }
            const thisBatch = [];
            for (var i = 0, itemToAdd = null; i < BATCH_SIZE && (itemToAdd = createItems.shift()); i++) {
                thisBatch.push(itemToAdd);
            }
            console.log('Writing batch ' + (currentBatch++) + '/' + Math.ceil(data.length / BATCH_SIZE));
            var params = {
                RequestItems: {
                    "parkinghistory": thisBatch
                }
            };
            // Use Dynamodb batchWriteItem sdk function
            return ddb.batchWriteItem(params, function (err, data) {
                if (err) {
                    console.log("Error", err);
                } else {
                    console.log("Success", data);
                }
            })
            .promise()
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
        console.log("Imported Process Completed!!");
        process.exit(0);
    })
    .catch(err => { console.log(err) });
