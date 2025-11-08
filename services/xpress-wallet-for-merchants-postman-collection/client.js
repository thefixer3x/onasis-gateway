/**
 * xpress-wallet-for-merchants-postman-collection Service Client
 * Auto-generated from Postman collection
 */

const BaseClient = require('../../core/base-client');
const config = require('./xpress-wallet-for-merchants-postman-collection.json');

class Xpress_wallet_for_merchants_postman_collectionClient extends BaseClient {
    constructor(options = {}) {
        super({
            ...config,
            ...options
        });
    }

    // Auto-generated methods will be added here
    // Based on the extracted endpoints
}

module.exports = Xpress_wallet_for_merchants_postman_collectionClient;
