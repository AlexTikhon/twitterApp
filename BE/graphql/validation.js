const { GraphQLError, Kind } = require('graphql');

// Fields that run bcrypt (cost 12) and therefore dominate request cost. They are priced above
// ordinary fields so that one authentication field consumes a large part of the complexity limit.
const AUTH_FIELDS = new Set(['login', 'createUser']);
const AUTH_FIELD_COST = 100;
// Validation walks fragment spreads once per use, so a few nested spreads can expand
// exponentially. This caps the selections visited per operation, independent of the limits above.
const MAX_VISITED_SELECTIONS = 10_000;

class ValidationBudgetError extends Error {}

const collectFragments = (document) =>
  new Map(
    document.definitions
      .filter((definition) => definition.kind === Kind.FRAGMENT_DEFINITION)
      .map((definition) => [definition.name.value, definition])
  );

const getOperations = (document) =>
  document.definitions.filter((definition) => definition.kind === Kind.OPERATION_DEFINITION);

const walkSelections = (
  selectionSet,
  fragments,
  visitField,
  { depth = 0, spreadPath = new Set(), budget = { visited: 0 } } = {}
) => {
  if (!selectionSet) {
    return;
  }

  for (const selection of selectionSet.selections) {
    budget.visited += 1;
    if (budget.visited > MAX_VISITED_SELECTIONS) {
      throw new ValidationBudgetError();
    }

    if (selection.kind === Kind.FIELD) {
      visitField(selection, depth + 1);
      walkSelections(selection.selectionSet, fragments, visitField, {
        depth: depth + 1,
        spreadPath,
        budget
      });
    } else if (selection.kind === Kind.INLINE_FRAGMENT) {
      walkSelections(selection.selectionSet, fragments, visitField, { depth, spreadPath, budget });
    } else if (selection.kind === Kind.FRAGMENT_SPREAD && !spreadPath.has(selection.name.value)) {
      const fragment = fragments.get(selection.name.value);
      if (fragment) {
        walkSelections(fragment.selectionSet, fragments, visitField, {
          depth,
          spreadPath: new Set(spreadPath).add(selection.name.value),
          budget
        });
      }
    }
  }
};

// Runs a per-operation analysis and converts an exhausted walk into a validation error.
const createOperationRule = (analyze) => (context) => ({
  Document(document) {
    const fragments = collectFragments(document);

    for (const operation of getOperations(document)) {
      try {
        const message = analyze(operation, fragments);
        if (message) {
          context.reportError(new GraphQLError(message, { nodes: operation }));
        }
      } catch (error) {
        if (!(error instanceof ValidationBudgetError)) {
          throw error;
        }
        context.reportError(
          new GraphQLError('Query is too large to validate.', { nodes: operation })
        );
      }
    }
  }
});

const createDepthLimitRule = (maximumDepth) =>
  createOperationRule((operation, fragments) => {
    let depth = 0;
    walkSelections(operation.selectionSet, fragments, (_field, fieldDepth) => {
      depth = Math.max(depth, fieldDepth);
    });

    return depth > maximumDepth
      ? `Query depth ${depth} exceeds the maximum of ${maximumDepth}.`
      : null;
  });

const createComplexityLimitRule = (maximumComplexity) =>
  createOperationRule((operation, fragments) => {
    let complexity = 0;
    walkSelections(operation.selectionSet, fragments, (field) => {
      complexity += AUTH_FIELDS.has(field.name.value) ? AUTH_FIELD_COST : 1;
    });

    return complexity > maximumComplexity
      ? `Query complexity ${complexity} exceeds the maximum of ${maximumComplexity}.`
      : null;
  });

// Aliases and fragments cannot hide a second authentication field: the field name, not the
// response key, is counted wherever it is reached from the operation root.
const createSingleAuthFieldRule = () =>
  createOperationRule((operation, fragments) => {
    let authFields = 0;
    walkSelections(operation.selectionSet, fragments, (field, depth) => {
      if (depth === 1 && AUTH_FIELDS.has(field.name.value)) {
        authFields += 1;
      }
    });

    return authFields > 1 ? 'An operation may contain at most one authentication field.' : null;
  });

const createValidationRules = ({ maxDepth, maxComplexity }) => [
  createDepthLimitRule(maxDepth),
  createComplexityLimitRule(maxComplexity),
  createSingleAuthFieldRule()
];

module.exports = {
  createComplexityLimitRule,
  createDepthLimitRule,
  createSingleAuthFieldRule,
  createValidationRules
};
