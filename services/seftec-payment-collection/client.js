/**
 * seftec-payment-collection Service Client
 * Auto-generated from Postman collection
 */

const BaseClient = require('../../core/base-client');
const config = require('./seftec-payment-collection.json');

class Seftec_payment_collectionClient extends BaseClient {
    constructor(options = {}) {
        super({
            ...config,
            ...options
        });
    }

    // Auto-generated methods will be added here
    // Based on the extracted endpoints
}

module.exports = Seftec_payment_collectionClient;
