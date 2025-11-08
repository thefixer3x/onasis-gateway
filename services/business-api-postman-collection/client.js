/**
 * business-api-postman-collection Service Client
 * Auto-generated from Postman collection
 */

const BaseClient = require('../../core/base-client');
const config = require('./business-api-postman-collection.json');

class Business_api_postman_collectionClient extends BaseClient {
    constructor(options = {}) {
        super({
            ...config,
            ...options
        });
    }

    // Auto-generated methods will be added here
    // Based on the extracted endpoints
}

module.exports = Business_api_postman_collectionClient;
