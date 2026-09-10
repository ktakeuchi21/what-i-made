"use strict";
const { createHandler, createPostAuthenticationHandler } = require("./index");
module.exports = { handler: createHandler(), postAuthenticationHandler: createPostAuthenticationHandler() };
