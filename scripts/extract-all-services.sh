#!/bin/bash

# Extract All Services Script
# Processes all 19 JSON files and extracts service configurations
# Usage: ./extract-all-services.sh

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
SERVICES_DIR="$PROJECT_DIR/services"
LOGS_DIR="$PROJECT_DIR/logs"

# Create necessary directories
mkdir -p "$SERVICES_DIR"
mkdir -p "$LOGS_DIR"

echo -e "${BLUE}🚀 Starting comprehensive service extraction...${NC}"
echo -e "${BLUE}📁 Project Directory: $PROJECT_DIR${NC}"
echo -e "${BLUE}📁 Services Output: $SERVICES_DIR${NC}"

# Initialize counters
TOTAL_FILES=0
SUCCESSFUL_EXTRACTIONS=0
FAILED_EXTRACTIONS=0

# Create extraction log
LOG_FILE="$LOGS_DIR/extraction-$(date +%Y%m%d-%H%M%S).log"
echo "Service Extraction Log - $(date)" > "$LOG_FILE"
echo "=======================================" >> "$LOG_FILE"

# Function to extract service
extract_service() {
    local json_file="$1"
    local filename=$(basename "$json_file" .json)
    local service_name=$(echo "$filename" | sed 's/[^a-zA-Z0-9]/-/g' | tr '[:upper:]' '[:lower:]')
    
    echo -e "${YELLOW}📦 Processing: $filename${NC}"
    echo "Processing: $filename" >> "$LOG_FILE"
    
    # Create service-specific directory
    local service_dir="$SERVICES_DIR/$service_name"
    mkdir -p "$service_dir"
    
    # Extract service configuration
    if node "$SCRIPT_DIR/extract-service.js" "$json_file" "$service_dir" >> "$LOG_FILE" 2>&1; then
        echo -e "${GREEN}✅ Successfully extracted: $service_name${NC}"
        echo "SUCCESS: $service_name" >> "$LOG_FILE"
        ((SUCCESSFUL_EXTRACTIONS++))
        
        # Generate additional files for the service
        generate_service_files "$service_dir" "$service_name"
    else
        echo -e "${RED}❌ Failed to extract: $service_name${NC}"
        echo "FAILED: $service_name" >> "$LOG_FILE"
        ((FAILED_EXTRACTIONS++))
    fi
    
    echo "---" >> "$LOG_FILE"
}

# Function to generate additional service files
generate_service_files() {
    local service_dir="$1"
    local service_name="$2"
    
    # Generate service client template
    local class_name=$(echo "$service_name" | sed 's/-/_/g' | awk '{print toupper(substr($0,1,1)) tolower(substr($0,2))}')
    cat > "$service_dir/client.js" << EOF
/**
 * $service_name Service Client
 * Auto-generated from Postman collection
 */

const BaseClient = require('../../core/base-client');
const config = require('./$service_name.json');

class ${class_name}Client extends BaseClient {
    constructor(options = {}) {
        super({
            ...config,
            ...options
        });
    }

    // Auto-generated methods will be added here
    // Based on the extracted endpoints
}

module.exports = ${class_name}Client;
EOF

    # Generate webhook handler template
    cat > "$service_dir/webhooks.js" << EOF
/**
 * $service_name Webhook Handlers
 * Auto-generated webhook processing
 */

class ${class_name}WebhookHandler {
    constructor(config) {
        this.config = config;
    }

    // Webhook handlers will be generated based on
    // the webhook configurations found in the service
}

module.exports = ${class_name}WebhookHandler;
EOF

    # Generate test template
    cat > "$service_dir/test.js" << EOF
/**
 * $service_name Integration Tests
 * Auto-generated test suite
 */

const ${class_name}Client = require('./client');
const config = require('./$service_name.json');

describe('$service_name Integration Tests', () => {
    let client;

    beforeEach(() => {
        client = new ${class_name}Client({
            // Test configuration
        });
    });

    // Test cases will be generated based on
    // the extracted endpoints and their configurations
});
EOF

    echo -e "${GREEN}  📄 Generated client, webhooks, and test files${NC}"
}

# Main extraction process
echo -e "${BLUE}🔍 Scanning for JSON files...${NC}"

# Find all JSON files (excluding package.json and other non-API files)
JSON_FILES=(
    "7. Wise Multicurrency Account (MCA) - Platform API's.postman_collection.json"
    "API testing basics.postman_collection.json"
    "BAP.postman_collection.json"
    "Business API.postman_collection.json"
    "EDoc External App Integration - FOR CLIENTS.postman_collection.json"
    "Google Analytics API V3.postman_collection.json"
    "Hostinger API.postman_collection.json"
    "Merchant API.postman_collection.json"
    "Multi Currency Account.postman_collection.json"
    "Open Banking API.postman_collection.json"
    "SaySwitch API Integration.postman_collection.json"
    "Shutterstock API.postman_collection.json"
    "Xpress Wallet For Merchants.postman_collection.json"
    "ngrok API for use with Flows.postman_collection.json"
    "ngrok API.postman_collection.json"
    "ngrok Examples.postman_collection.json"
    "seftec-payment-collection.json"
    "⭐️ Stripe API [2024-04-10].postman_collection.json"
)

TOTAL_FILES=${#JSON_FILES[@]}
echo -e "${BLUE}📊 Found $TOTAL_FILES API collection files${NC}"

# Process each JSON file
for json_file in "${JSON_FILES[@]}"; do
    full_path="$PROJECT_DIR/$json_file"
    if [[ -f "$full_path" ]]; then
        extract_service "$full_path"
    else
        echo -e "${RED}❌ File not found: $json_file${NC}"
        echo "FILE NOT FOUND: $json_file" >> "$LOG_FILE"
        ((FAILED_EXTRACTIONS++))
    fi
done

# Generate master service catalog
echo -e "${BLUE}📋 Generating master service catalog...${NC}"
cat > "$SERVICES_DIR/catalog.json" << EOF
{
    "version": "1.0.0",
    "generated": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
    "totalServices": $SUCCESSFUL_EXTRACTIONS,
    "services": [
EOF

# Add each successfully extracted service to catalog
first=true
for service_dir in "$SERVICES_DIR"/*/; do
    if [[ -d "$service_dir" ]]; then
        service_name=$(basename "$service_dir")
        config_file="$service_dir/$service_name.json"
        
        if [[ -f "$config_file" ]]; then
            if [[ "$first" == true ]]; then
                first=false
            else
                echo "," >> "$SERVICES_DIR/catalog.json"
            fi
            
            # Extract key info for catalog
            name=$(jq -r '.name' "$config_file")
            capabilities=$(jq -r '.capabilities | join(", ")' "$config_file")
            endpoints_count=$(jq -r '.endpoints | length' "$config_file")
            
            cat >> "$SERVICES_DIR/catalog.json" << EOF
        {
            "name": "$name",
            "directory": "$service_name",
            "capabilities": $(jq '.capabilities' "$config_file"),
            "endpointsCount": $endpoints_count,
            "authentication": $(jq '.authentication' "$config_file"),
            "configFile": "$service_name.json"
        }
EOF
        fi
    fi
done

cat >> "$SERVICES_DIR/catalog.json" << EOF

    ]
}
EOF

# Generate summary report
echo -e "${BLUE}📊 Generating extraction summary...${NC}"
cat > "$LOGS_DIR/extraction-summary.json" << EOF
{
    "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
    "totalFiles": $TOTAL_FILES,
    "successfulExtractions": $SUCCESSFUL_EXTRACTIONS,
    "failedExtractions": $FAILED_EXTRACTIONS,
    "successRate": "$(echo "scale=2; $SUCCESSFUL_EXTRACTIONS * 100 / $TOTAL_FILES" | bc)%",
    "outputDirectory": "$SERVICES_DIR",
    "logFile": "$LOG_FILE"
}
EOF

# Final summary
echo -e "\n${GREEN}🎉 Extraction Complete!${NC}"
echo -e "${GREEN}✅ Successfully extracted: $SUCCESSFUL_EXTRACTIONS services${NC}"
echo -e "${RED}❌ Failed extractions: $FAILED_EXTRACTIONS${NC}"
echo -e "${BLUE}📁 Services directory: $SERVICES_DIR${NC}"
echo -e "${BLUE}📄 Master catalog: $SERVICES_DIR/catalog.json${NC}"
echo -e "${BLUE}📋 Detailed log: $LOG_FILE${NC}"

# Check if all extractions were successful
if [[ $FAILED_EXTRACTIONS -eq 0 ]]; then
    echo -e "\n${GREEN}🚀 All services extracted successfully! Ready for MCP integration.${NC}"
    exit 0
else
    echo -e "\n${YELLOW}⚠️  Some extractions failed. Check the log file for details.${NC}"
    exit 1
fi
