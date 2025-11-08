/**
 * api-testing-basics-postman-collection Service Client
 * Auto-generated from Postman collection
 */

const BaseClient = require('../../core/base-client');
const config = require('./api-testing-basics-postman-collection.json');

class Api_testing_basics_postman_collectionClient extends BaseClient {
    constructor(options = {}) {
        super({
            ...config,
            ...options
        });
    }

    // Auto-generated methods will be added here
    // Based on the extracted endpoints
}

module.exports = Api_testing_basics_postman_collectionClient;
