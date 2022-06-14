
var AWS = require('aws-sdk');
// Configuring constants
const DDB_TABLENAME = 'parkinghistory';
const ddb = new AWS.DynamoDB();

/**
 * @type {import('@types/aws-lambda').APIGatewayProxyHandler}
 */
exports.handler = function(event,context,callback) {
    console.log(`EVENT: ${JSON.stringify(event)}`);
    console.log(event.queryStringParameters.deviceID.toString());
    console.log(event.queryStringParameters.ts1);
    console.log(event.queryStringParameters.ts2);
// Use dynamodb query SDK to retrieve records.
    var params = {
        TableName:DDB_TABLENAME,
        KeyConditionExpression: "#dev = :dev AND #ts BETWEEN :ts1 AND :ts2",
        ExpressionAttributeNames: {
            '#dev': 'deviceID',
            '#ts' : 'timestamp'
        },
        ExpressionAttributeValues : {
            ':dev' : {S: event.queryStringParameters.deviceID.toString() },
            ':ts1' : {N:event.queryStringParameters.ts1},
            ':ts2' : {N:event.queryStringParameters.ts2}
        }
    };
     var response = {};
    ddb.query(params, function (err,data) {
        if(err) {
            console.error("Query execution failed. error:", JSON.stringify(err));
            callback(Error(err));
        }
        else {
            console.log("Query succeeded: "+ JSON.stringify(data));
             response.statusCode = 200;
             response.body = JSON.stringify(data);
            callback(null,response);

        }
    });
  
};
