const { ddb, ScanCommand } = require("../shared/ddb.js");

exports.handler = async () => {
  const result = await ddb.send(new ScanCommand({ TableName: process.env.PRODUCTS_TABLE }));
  return {
    statusCode: 200,
    headers: { "Access-Control-Allow-Origin": "*" },
    body: JSON.stringify(result.Items || []),
  };
};
