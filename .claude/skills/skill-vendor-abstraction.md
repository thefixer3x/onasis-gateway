---
name: vendor-abstraction-guardian
description: Guardrails for edits to core/abstraction/vendor-abstraction.js that preserve vendor isolation, mappings, fallback selection, and stable client-facing schemas. Use when adding/removing vendors, operations, or schema fields in the vendor abstraction layer.
---

# Vendor Abstraction Guardian

## Operating Constraints
- Work only in `core/abstraction/vendor-abstraction.js`.
- Keep vendor specifics hidden behind client-facing schemas.

## Non-Negotiables (Never Do)

### Schema Isolation
- Never expose vendor-specific field names in client schema.
- Never return vendor responses directly to clients without transform.
- Never encode vendor-specific validation into client schema.

### Vendor Selection
- Never hardcode vendor selection in business logic.
- Never remove a vendor without a 30‑day deprecation.
- Never let client input reveal vendor selection.
- Never expose vendor IDs in client responses.

### Schema Stability
- Never add required fields to existing client schemas.
- Never remove/rename fields or change types.

### Category Management
- Never remove categories without migrating all operations.
- Never merge categories.
- Never duplicate operations across categories.

## Required Patterns (Must Follow)

### Client Schema Definition
```javascript
// MUST define schema with type and required flag
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
// MUST use pure functions for transforms
// Input: client schema -> Output: vendor-specific format
transform: (input) => ({
    vendor_field: input.clientField,
    vendor_amount: input.amount * 100,  // Unit conversion here
    reference: input.reference || `prefix_${Date.now()}`
})
```

### Vendor Fallback Pattern
```javascript
// MUST have fallback vendor for critical categories
const vendors = Object.keys(abstraction.vendors);
const selectedVendor = vendorPreference && vendors.includes(vendorPreference)
    ? vendorPreference
    : vendors[0];  // Fallback to first available
```

### Input Validation
```javascript
// MUST validate before vendor call
this.validateInput(input, clientSchema.schema);

// Validation MUST check:
// 1. Required fields present
// 2. Field types match schema
// 3. Apply defaults for missing optional fields
```

### Vendor Isolation
```javascript
// Client input NEVER touches vendor code directly
// Flow: client input -> validation -> transform -> vendor call
async executeAbstractedCall(category, operation, input, vendorPreference) {
    const abstraction = this.vendorMappings.get(category);
    this.validateInput(input, abstraction.client[operation].schema);
    const vendorInput = mapping.transform(input);  // Isolation point
    return await this.executeVendorCall(vendorConfig.adapter, mapping.tool, vendorInput);
}
```

## Safe Modification Examples

### Adding a New Vendor
```javascript
// Add to existing category - do NOT modify client schema
vendors: {
    'existing-vendor': { /* keep unchanged */ },
    'new-vendor': {
        adapter: 'new-vendor-api',
        mappings: {
            initializeTransaction: {
                tool: 'create-payment',
                transform: (input) => ({
                    // Map from client schema to vendor format
                    customer_email: input.email,
                    payment_amount: input.amount,
                    // ... vendor-specific fields
                })
            }
        }
    }
}
```

### Adding a New Operation to Existing Category
```javascript
// Add to client schema with OPTIONAL fields only
client: {
    existingOperation: { /* keep unchanged */ },
    newOperation: {
        schema: {
            requiredField: { type: 'string', required: true },
            // All NEW operations can have required fields
        }
    }
}

// Add mappings to ALL vendors
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

## Integration Points

| Component | Integration Method |
|-----------|-------------------|
| Base Client | Vendor calls routed through `executeVendorCall()` |
| MCP Server | Categories exposed as tool groups |
| REST API | Operations exposed as endpoints |
| Metrics | Track per-vendor call metrics |

## Vendor Deprecation Process

When removing a vendor (30-day minimum):

```javascript
// Day 1: Mark as deprecated
vendors: {
    'old-vendor': {
        adapter: 'old-vendor-api',
        deprecated: true,
        deprecationDate: '2024-01-15',
        migrateTo: 'new-vendor',
        mappings: { /* unchanged */ }
    }
}

// Day 30+: Remove vendor
// Remove 'old-vendor' from vendors object
```

## Testing Requirements

Before any changes to this file:

```bash
# 1. Run abstraction tests (if present)
npm test -- --grep "VendorAbstraction"

# 2. Verify schema validation
node -e "
const VAL = require('./core/abstraction/vendor-abstraction');
const val = new VAL();
console.log('Categories:', val.getAvailableCategories());
console.log('Payment ops:', val.getCategoryOperations('payment'));
"

# 3. Test each vendor transform
# Verify output matches vendor API spec

# 4. Test vendor fallback
# Verify primary vendor failure falls back to secondary
```

## Rollback Procedure

If changes cause issues:

1. **Immediate Rollback**
   ```bash
   git checkout HEAD~1 -- core/abstraction/vendor-abstraction.js
   ```

2. **Verify Categories**
   ```javascript
   const val = new VendorAbstractionLayer();
   console.log('Available categories:', val.getAvailableCategories());
   // Expected: ['payment', 'banking', 'infrastructure']
   ```

3. **Test Critical Operations**
   ```javascript
   // Test payment flow
   await val.executeAbstractedCall('payment', 'initializeTransaction', {
       amount: 1000,
       email: 'test@example.com'
   });
   ```

## Client Schema Registry

| Category | Operation | Required Fields | Optional Fields |
|----------|-----------|-----------------|-----------------|
| payment | initializeTransaction | amount, email | currency, reference, metadata |
| payment | verifyTransaction | reference | |
| payment | createCustomer | email | firstName, lastName, phone |
| banking | getAccountBalance | accountId | |
| banking | transferFunds | fromAccount, toAccount, amount | currency, reference |
| banking | verifyAccount | accountNumber, bankCode | |
| infrastructure | createTunnel | port | subdomain, region |
| infrastructure | listTunnels | | |
