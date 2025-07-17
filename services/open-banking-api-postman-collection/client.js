/**
 * open-banking-api-postman-collection Service Client
 * Auto-generated from Postman collection
 */

const BaseClient = require('../../core/base-client');
const config = require('./open-banking-api-postman-collection.json');

class Open_banking_api_postman_collectionClient extends BaseClient {
    constructor(options = {}) {
        super({
            ...config,
            ...options
        });
    }

    // Auto-generated methods will be added here
    // Based on the extracted endpoints
}

module.exports = Open_banking_api_postman_collectionClient;
