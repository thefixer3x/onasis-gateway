---
name: compliance-manager-guardian
description: Guardrails for edits to core/security/compliance-manager.js that preserve PCI/GDPR/PSD2/SOX/HIPAA controls (masking, encryption, SCA, consent checks, and audit logging). Use when changing compliance validators, security handling, or audit flows.
---

# Compliance Manager Guardian

## Operating Constraints
- Work only in `core/security/compliance-manager.js`.
- Preserve regulatory guarantees for PCI-DSS, GDPR, PSD2, SOX, and HIPAA.

## Non-Negotiables (Never Do)

### Compliance Validators
- **NEVER** disable or bypass compliance validators
- **NEVER** weaken validation rules (e.g., making required checks optional)
- **NEVER** skip validation for "trusted" sources
- **NEVER** add bypass flags or debug modes that skip compliance

### PCI-DSS Rules
- **NEVER** log these PCI fields (even in debug mode):
  - `cvv`, `cvv2`, `cvc`, `cvc2`, `cid`, `cav2`
  - `pin`, `pinBlock`
  - `track1`, `track2`, `magneticStripe`
- **NEVER** weaken card masking:
  - MUST show only first 6 and last 4 digits
  - Middle digits MUST be masked with `*`
- **NEVER** reduce encryption below AES-256-GCM
- **NEVER** store CVV/PIN after authorization

### GDPR Rules
- **NEVER** process personal data without consent check
- **NEVER** skip pseudonymization for personal identifiers
- **NEVER** retain personal data beyond retention period
- **NEVER** disable data minimization for analytics

### PSD2 Rules
- **NEVER** reduce SCA requirements below 2 factors
- **NEVER** bypass SCA for amounts over threshold
- **NEVER** skip transaction monitoring for high-value transactions
- **NEVER** disable cumulative amount tracking

### Audit Logging
- **NEVER** skip audit logging for sensitive operations
- **NEVER** delete or modify existing audit entries
- **NEVER** log sensitive data in audit trails (mask first)
- **NEVER** disable audit persistence

### Security Rollback
- **NEVER** rollback security fixes without security team approval
- **NEVER** lower security levels in production

## Required Patterns (Must Follow)

### Card Number Masking
```javascript
// MUST mask showing only first 6 and last 4
maskCardNumber(cardNumber) {
    const cleaned = cardNumber.replace(/\D/g, '');
    const first6 = cleaned.substring(0, 6);
    const last4 = cleaned.substring(cleaned.length - 4);
    const masked = '*'.repeat(cleaned.length - 10);
    return `${first6}${masked}${last4}`;
}
// Example: 4111111111111111 -> 411111******1111
```

### Data Encryption
```javascript
// MUST use AES-256-GCM
encryptSensitiveData(data) {
    const algorithm = 'aes-256-gcm';  // DO NOT change
    // Prefer @onasis/security-sdk for encryption primitives
    // Do not downgrade algorithms or omit auth tags

    const cipher = crypto.createCipher(algorithm, key);
    cipher.setAAD(Buffer.from('compliance-encryption'));

    // Return encrypted with IV and auth tag
    return {
        encrypted,
        iv: iv.toString('hex'),
        authTag: authTag.toString('hex'),
        algorithm
    };
}
```

### Strong Customer Authentication
```javascript
// MUST require 2+ factors
validateSCA(data) {
    const factors = [];

    if (data.password || data.pin) factors.push('knowledge');
    if (data.deviceId || data.token) factors.push('possession');
    if (data.biometric || data.fingerprint) factors.push('inherence');

    return factors.length >= 2;  // PSD2 requirement
}
```

### Defense in Depth
```javascript
// MUST apply all applicable protections
enforceDataHandling(serviceId, data, operation) {
    let processedData = { ...data };

    // Apply ALL applicable protections - not just one
    if (service?.compliance?.pci) {
        processedData = this.applyPCIProtections(processedData, operation);
    }
    if (service?.compliance?.gdpr) {
        processedData = this.applyGDPRProtections(processedData, operation);
    }
    if (service?.compliance?.psd2) {
        processedData = this.applyPSD2Protections(processedData, operation);
    }

    return processedData;
}
```

### Audit Entry Creation
```javascript
// MUST create audit entry for all compliance events
logAuditEntry(action, details) {
    const entry = {
        timestamp: new Date(),
        action,
        details,
        id: crypto.randomUUID()
    };

    this.auditLog.push(entry);
    this.emit('audit:logged', entry);
    this.persistAuditEntry(entry);  // MUST persist
}
```

## Safe Modification Examples

### Adding a New Regulation Validator
```javascript
// Add new validator class
class NewRegulationValidator {
    async validate(serviceConfig) {
        const violations = [];
        const recommendations = [];

        // Add validation rules
        if (!this.checkRequirement(serviceConfig)) {
            violations.push('Regulation X.Y: Requirement description');
        }

        return {
            compliant: violations.length === 0,
            violations,
            recommendations
        };
    }
}

// Register in constructor
this.regulations = {
    // ... existing validators
    NEW_REG: new NewRegulationValidator()
};
```

### Adding New PCI Protected Fields
```javascript
// Add to pciFields array - do NOT remove existing
const pciFields = [
    'cvv', 'pin', 'track1', 'track2', 'magneticStripe',
    'newSensitiveField'  // ADD here
];
```

### Adding New Consent Requirements
```javascript
// Extend consentRequiredFields - do NOT remove existing
const consentRequiredFields = [
    'email', 'phone', 'address', 'personalId',
    'biometric', 'location', 'behavioralData',
    'newPersonalDataField'  // ADD here
];
```

### Adding Audit Entry Types
```javascript
// Add new audit action types
this.logAuditEntry('NEW_COMPLIANCE_ACTION', {
    serviceId,
    details: 'What happened',
    regulation: 'REGULATION_NAME'
});
```

## Integration Points

| Component | Integration Method |
|-----------|-------------------|
| Base Client | Data passed through `enforceDataHandling()` |
| Metrics Collector | `compliance_violations_total` metric |
| API Routes | Middleware for request validation |
| Database | Audit entries persisted to `audit.compliance_log` |

## Prohibited Fields Registry

| Field | Regulation | Storage | Logging | Transmission |
|-------|------------|---------|---------|--------------|
| cvv, cvv2, cvc, cvc2 | PCI-DSS 3.2 | NEVER | NEVER | HTTPS only |
| pin, pinBlock | PCI-DSS 3.4 | NEVER | NEVER | Encrypted |
| track1, track2 | PCI-DSS 3.2 | NEVER | NEVER | NEVER |
| magneticStripe | PCI-DSS 3.2 | NEVER | NEVER | NEVER |
| Full card number | PCI-DSS 3.4 | Encrypted | Masked | Encrypted |

## Testing Requirements

Before any changes to this file:

```bash
# 1. Run compliance tests (if present)
npm test -- --grep "ComplianceManager"

# 2. Verify card masking
node -e "
const CM = require('./core/security/compliance-manager');
const cm = new CM();
console.log(cm.maskCardNumber('4111111111111111'));
// Expected: 411111******1111
"

# 3. Test SCA validation
node -e "
const CM = require('./core/security/compliance-manager');
const cm = new CM();
console.log('1 factor:', cm.validateSCA({ password: 'x' }));  // false
console.log('2 factors:', cm.validateSCA({ password: 'x', deviceId: 'y' }));  // true
"

# 4. Verify encryption uses AES-256-GCM
# Check algorithm in encryptSensitiveData()
```

## Rollback Procedure

**WARNING: Security fixes should NEVER be rolled back without security team approval.**

If rollback is absolutely necessary:

1. **Get Approval**
   - Contact security team
   - Document reason for rollback
   - Get written approval

2. **Conditional Rollback**
   ```bash
   # Only rollback non-security changes
   git diff HEAD~1 core/security/compliance-manager.js | grep -E "encrypt|mask|validate"
   # If any security functions changed, DO NOT rollback
   ```

3. **Verify Compliance**
   ```javascript
   const cm = new ComplianceManager();
   const results = await cm.validateServiceCompliance(testConfig);
   console.log('Overall:', results.overall);  // Must be COMPLIANT
   ```

4. **Audit the Rollback**
   ```javascript
   cm.logAuditEntry('COMPLIANCE_ROLLBACK', {
       reason: 'Documented reason',
       approvedBy: 'Security team member',
       date: new Date()
   });
   ```

## Compliance Validation Checklist

Before deploying changes:

- [ ] All card data properly masked (first 6, last 4 only)
- [ ] CVV/PIN never logged or stored
- [ ] Encryption uses AES-256-GCM
- [ ] SCA requires 2+ factors
- [ ] Audit entries created for all operations
- [ ] GDPR consent check in place
- [ ] Data minimization applied for analytics
- [ ] No PII in metric labels
- [ ] Audit log persisted to secure storage
