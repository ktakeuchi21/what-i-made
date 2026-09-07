"use strict";

const { createHandler } = require("./index");
const { createBedrockGenerateProvider, createBedrockMantleClient, createBedrockSearchProvider } = require("./bedrock-providers");

function createDeploymentHandler(options = {}) {
  const environment = options.environment || process.env;
  let application;
  return async function deployedRecipeIdeasHandler(event) {
    if (!application) {
      let searchProvider;
      let generateProvider;
      try {
        const client = createBedrockMantleClient({
          environment,
          fetchImpl: options.bedrockFetchImpl,
          credentialsProvider: options.credentialsProvider,
          now: options.bedrockNow,
          timeoutMs: options.bedrockTimeoutMs,
        });
        const model = environment.BEDROCK_MODEL_ID || "openai.gpt-5.6-terra";
        searchProvider = createBedrockSearchProvider({ client, model });
        generateProvider = createBedrockGenerateProvider({ client, model });
      } catch {
        // The core handler exposes configured provider routes as safely unavailable.
      }
      application = createHandler({
        searchProvider,
        generateProvider,
        fetchImpl: options.sourceFetchImpl,
        lookup: options.lookup,
        logger: options.logger,
        now: options.now,
      }, environment);
    }
    return application(event);
  };
}

const handler = createDeploymentHandler();

module.exports = { createDeploymentHandler, handler };
