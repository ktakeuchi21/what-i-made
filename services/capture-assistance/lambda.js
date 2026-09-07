"use strict";

const { createProvider } = require("./bedrock-provider");
const { createHandler } = require("./index");

function createDeploymentHandler(options = {}) {
  const environment = options.environment || process.env;
  const provider = createProvider({ environment, fetchImpl: options.fetchImpl, credentialsProvider: options.credentialsProvider, now: options.bedrockNow, timeoutMs: options.timeoutMs });
  return createHandler({ provider, logger: options.logger, now: options.now }, environment);
}

module.exports = { createDeploymentHandler, handler: createDeploymentHandler() };
