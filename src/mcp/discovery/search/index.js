/**
 * Search Engine
 *
 * Deterministic ranking for intent matching.
 * Uses tag overlap, keyword matching, and confidence thresholds.
 *
 * Design principle: Intent is a resolver, not a guesser.
 * Low confidence → return options + ask for clarification.
 */

class SearchEngine {
    constructor(registry) {
        this.registry = registry;
        this.minConfidence = parseFloat(process.env.MCP_SEARCH_MIN_CONFIDENCE || '0.3');
    }

    /**
     * Search for operations matching a query
     */
    search(query, options = {}) {
        const { adapter, context, limit = 3 } = options;

        // Tokenize query
        const queryTokens = this.tokenize(query);
        const queryLower = query.toLowerCase();

        // Get candidate operations
        let candidates;
        if (adapter) {
            // Adapter-specific search
            candidates = this.registry.getAdapterOperations(adapter);
        } else {
            // Global search
            candidates = Array.from(this.registry.operations.values());
        }

        // Score each candidate
        const scored = candidates.map(op => ({
            operation: op,
            score: this.scoreOperation(op, queryTokens, queryLower, context)
        }));

        // Sort by score descending
        scored.sort((a, b) => b.score - a.score);

        // Filter by minimum confidence
        const filtered = scored.filter(s => s.score >= this.minConfidence);

        // Take top results
        const results = filtered.slice(0, limit);

        // Determine if we need clarification
        const needsSelection = results.length > 1 &&
            (results[0].score < 0.7 || results[0].score - results[1].score < 0.15);

        return {
            results: results.map(r => ({
                ...r.operation,
                confidence: r.score,
                why: this.generateReason(r.operation, queryTokens)
            })),
            needs_selection: needsSelection,
            mode: adapter ? 'adapter-specific' : 'global',
            query_interpreted: this.interpretQuery(queryTokens, context)
        };
    }

    /**
     * Score an operation against the query
     */
    scoreOperation(operation, queryTokens, queryLower, context = {}) {
        let score = 0;
        const weights = {
            exactToolMatch: 0.5,
            exactAdapterMatch: 0.3,
            tagOverlap: 0.25,
            nameMatch: 0.2,
            descriptionMatch: 0.15,
            categoryMatch: 0.1,
            contextMatch: 0.1
        };

        // Exact tool_id match (highest priority)
        if (queryLower === operation.tool_id.toLowerCase()) {
            score += weights.exactToolMatch;
        }

        // Exact adapter match
        if (queryLower.includes(operation.adapter.toLowerCase())) {
            score += weights.exactAdapterMatch;
        }

        // Tag overlap
        const tagScore = this.calculateTagOverlap(queryTokens, operation.tags);
        score += tagScore * weights.tagOverlap;

        // Name keyword match
        const nameTokens = this.tokenize(operation.name);
        const nameOverlap = this.tokenOverlap(queryTokens, nameTokens);
        score += nameOverlap * weights.nameMatch;

        // Description keyword match
        if (operation.description) {
            const descTokens = this.tokenize(operation.description);
            const descOverlap = this.tokenOverlap(queryTokens, descTokens);
            score += descOverlap * weights.descriptionMatch;
        }

        // Category match
        if (queryTokens.some(t => operation.category.toLowerCase().includes(t))) {
            score += weights.categoryMatch;
        }

        // Context matching
        if (context) {
            if (context.country && operation.tags) {
                const countryLower = context.country.toLowerCase();
                if (operation.tags.some(t => t.toLowerCase().includes(countryLower))) {
                    score += weights.contextMatch;
                }
            }
            if (context.use_case && operation.tags) {
                if (operation.tags.some(t => t.includes(context.use_case))) {
                    score += weights.contextMatch;
                }
            }
        }

        // Boost non-mock adapters
        if (!operation.is_mock) {
            score *= 1.2;
        }

        // Cap at 1.0
        return Math.min(score, 1.0);
    }

    /**
     * Calculate tag overlap score
     */
    calculateTagOverlap(queryTokens, tags) {
        if (!tags || tags.length === 0) return 0;

        const tagSet = new Set(tags.map(t => t.toLowerCase()));
        let matches = 0;

        for (const token of queryTokens) {
            if (tagSet.has(token)) {
                matches++;
            }
            // Partial match
            for (const tag of tagSet) {
                if (tag.includes(token) || token.includes(tag)) {
                    matches += 0.5;
                }
            }
        }

        return matches / Math.max(queryTokens.length, 1);
    }

    /**
     * Calculate token overlap between two token arrays
     */
    tokenOverlap(tokensA, tokensB) {
        if (tokensA.length === 0 || tokensB.length === 0) return 0;

        const setB = new Set(tokensB);
        let matches = 0;

        for (const token of tokensA) {
            if (setB.has(token)) {
                matches++;
            }
        }

        return matches / Math.max(tokensA.length, 1);
    }

    /**
     * Tokenize a string into searchable tokens
     */
    tokenize(text) {
        if (!text) return [];
        return text
            .toLowerCase()
            .replace(/[^a-z0-9\s-]/g, ' ')
            .split(/\s+/)
            .filter(t => t.length > 2)
            .filter(t => !this.isStopWord(t));
    }

    /**
     * Check if a word is a stop word
     */
    isStopWord(word) {
        const stopWords = new Set([
            'the', 'and', 'for', 'with', 'that', 'this', 'from', 'have', 'been',
            'would', 'could', 'should', 'will', 'can', 'may', 'might', 'must',
            'want', 'need', 'like', 'how', 'what', 'when', 'where', 'which', 'who',
            'please', 'help', 'using', 'use', 'make', 'get', 'set', 'via', 'api'
        ]);
        return stopWords.has(word);
    }

    /**
     * Generate a reason why this operation was matched
     */
    generateReason(operation, queryTokens) {
        const reasons = [];

        // Check what matched
        const nameLower = operation.name.toLowerCase();
        const matchedTokens = queryTokens.filter(t => nameLower.includes(t));

        if (matchedTokens.length > 0) {
            reasons.push(`Name matches: ${matchedTokens.join(', ')}`);
        }

        if (operation.tags && operation.tags.length > 0) {
            const matchedTags = operation.tags.filter(tag =>
                queryTokens.some(t => tag.toLowerCase().includes(t))
            );
            if (matchedTags.length > 0) {
                reasons.push(`Relevant tags: ${matchedTags.slice(0, 3).join(', ')}`);
            }
        }

        if (!operation.is_mock) {
            reasons.push('Live adapter with real execution');
        }

        if (reasons.length === 0) {
            reasons.push(`From ${operation.adapter} adapter`);
        }

        return reasons.join('. ');
    }

    /**
     * Interpret the query for display
     */
    interpretQuery(tokens, context = {}) {
        const parts = [...tokens];

        if (context.country) {
            parts.push(`country:${context.country}`);
        }
        if (context.currency) {
            parts.push(`currency:${context.currency}`);
        }
        if (context.use_case) {
            parts.push(`use_case:${context.use_case}`);
        }

        return parts.join(', ');
    }

    /**
     * Get common operations for an adapter (frequently used)
     */
    getCommonOperations(adapterId, limit = 5) {
        const operations = this.registry.getAdapterOperations(adapterId);

        // Prioritize operations that are likely common
        const scored = operations.map(op => {
            let score = 0;
            const nameLower = op.name.toLowerCase();

            // Common operation patterns
            if (nameLower.includes('list') || nameLower.includes('get')) score += 2;
            if (nameLower.includes('create') || nameLower.includes('initialize')) score += 3;
            if (nameLower.includes('verify') || nameLower.includes('validate')) score += 2;
            if (nameLower.includes('transaction')) score += 2;
            if (nameLower.includes('customer')) score += 1;

            // Boost non-mock
            if (!op.is_mock) score += 1;

            return { operation: op, score };
        });

        scored.sort((a, b) => b.score - a.score);
        return scored.slice(0, limit).map(s => s.operation.tool_id);
    }
}

module.exports = SearchEngine;
