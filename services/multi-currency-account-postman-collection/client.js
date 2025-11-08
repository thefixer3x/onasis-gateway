/**
 * multi-currency-account-postman-collection Service Client
 * Auto-generated from Postman collection
 */

const BaseClient = require('../../core/base-client');
const config = require('./multi-currency-account-postman-collection.json');

class Multi_currency_account_postman_collectionClient extends BaseClient {
    constructor(options = {}) {
        super({
            ...config,
            ...options
        });
    }

    // Auto-generated methods will be added here
    // Based on the extracted endpoints
}

module.exports = Multi_currency_account_postman_collectionClient;
