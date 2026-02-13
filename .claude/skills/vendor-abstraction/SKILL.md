---
name: vendor-abstraction
description: Guardrails for edits to core/abstraction/vendor-abstraction.js that preserve vendor isolation, mappings, fallback selection, and stable client-facing schemas. Use when adding/removing vendors, operations, or schema fields.
---

# Vendor Abstraction Guardian

## Purpose & Scope

Apply this skill when modifying `core/abstraction/vendor-abstraction.js`.

The Vendor Abstraction Layer provides:
- Isolation between client requests and vendor-specific implementations
- Schema validation for client inputs
- Transform functions to convert client input to vendor format
- Multi-vendor support with fallback capabilities
- Category-based service organization (payment, banking, infrastructure)

## Non-Negotiables (Never Do)

### Schema Isolation
- Never expose vendor-specific field names in client schema.
- Never let vendor response leak directly to client without transformation.
- Never add vendor-specific validation in client schema.

### Vendor Selection
- Never hardcode vendor selection logic in business code.
- Never remove a vendor without 30-day deprecation notice.
- Never make vendor selection observable from client input.
- Never expose vendor identifiers in client-facing responses.

### Schema Stability
- Never add required fields to existing client schemas.
- Never remove or rename fields from existing client schemas.
- Never change field types in existing client schemas.

### Category Management
- Never remove a category without migrating all operations.
- Never merge categories.
- Never duplicate operations across categories.

## Required Patterns (Must Follow)

### Client Schema Definition
```javascript
client: {
    operationName: {
        schema: {
            fieldName: { type: 'string', required: true },
            optionalField: { type: 'number', required: false },
            defaultedField: { type: 'string', default: 'value' }
        }
    }
}
```

### Vendor Transform Functions
```javascript
// Input: client schema -> Output: vendor-specific format
transform: (input) => ({
    vendor_field: input.clientField,
    vendor_amount: input.amount * 100,
    reference: input.reference || `prefix_${Date.now()}`
})
```

### Vendor Fallback Pattern
```javascript
const vendors = Object.keys(abstraction.vendors);
const selectedVendor = vendorPreference && vendors.includes(vendorPreference)
    ? vendorPreference
    : vendors[0];
```

### Input Validation
```javascript
this.validateInput(input, clientSchema.schema);
```

### Vendor Isolation
```javascript
// Flow: client input -> validation -> transform -> vendor call
async executeAbstractedCall(category, operation, input, vendorPreference) {
    const abstraction = this.vendorMappings.get(category);
    this.validateInput(input, abstraction.client[operation].schema);
    const vendorInput = mapping.transform(input);
    return await this.executeVendorCall(vendorConfig.adapter, mapping.tool, vendorInput);
}
```

## Safe Modification Examples

### Adding a New Vendor
```javascript
vendors: {
    'existing-vendor': { /* keep unchanged */ },
    'new-vendor': {
        adapter: 'new-vendor-api',
        mappings: {
            initializeTransaction: {
                tool: 'create-payment',
                transform: (input) => ({
                    customer_email: input.email,
                    payment_amount: input.amount
                })
            }
        }
    }
}
```

### Adding a New Operation to Existing Category
```javascript
client: {
    existingOperation: { /* keep unchanged */ },
    newOperation: {
        schema: {
            requiredField: { type: 'string', required: true }
        }
    }
}

vendors: {
    'vendor1': {
        mappings: {
            existingOperation: { /* unchanged */ },
            newOperation: { /* add here */ }
        }
    },
    'vendor2': {
        mappings: {
            newOperation: { /* must also add here */ }
        }
    }
}
```

### Adding a New Category
```javascript
this.registerAbstraction('newCategory', {
    client: {
        operationName: {
            schema: {
                field: { type: 'string', required: true }
            }
        }
    },
    vendors: {
        'primary-vendor': {
            adapter: 'vendor-api',
            mappings: {
                operationName: {
                    tool: 'vendor-tool-name',
                    transform: (input) => ({ /* mapping */ })
                }
            }
        }
    }
});
```

## Vendor Deprecation Process

Minimum 30-day window:
```javascript
vendors: {
    'old-vendor': {
        adapter: 'old-vendor-api',
        deprecated: true,
        deprecationDate: '2024-01-15',
        migrateTo: 'new-vendor',
        mappings: { /* unchanged */ }
    }
}
```

## Integration Points

| Component | Integration Method |
|-----------|-------------------|
| Base Client | Vendor calls routed through `executeVendorCall()` |
| MCP Server | Categories exposed as tool groups |
| REST API | Operations exposed as endpoints |
| Metrics | Track per-vendor call metrics |

## Client Schema Registry

| Category | Operation | Required Fields | Optional Fields |
|----------|-----------|-----------------|-----------------|
| payment | initializeTransaction | amount, email | currency, reference, metadata |
| payment | verifyTransaction | reference | |
| payment | createCustomer | email | firstName, lastName, phone |
| payment | purchaseAirtime | amount, phone, network | reference, metadata |
| payment | getTransaction | transactionId | |
| banking | getAccountBalance | accountId | |
| banking | transferFunds | fromAccount, toAccount, amount | currency, reference |
| banking | verifyAccount | accountNumber, bankCode | |
| infrastructure | createTunnel | port | subdomain, region |
| infrastructure | listTunnels | | |
