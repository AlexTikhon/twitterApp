const { GraphQLError, Kind } = require('graphql');

const collectFragments = (document) =>
  new Map(
    document.definitions
      .filter((definition) => definition.kind === Kind.FRAGMENT_DEFINITION)
      .map((definition) => [definition.name.value, definition])
  );

const walkSelections = (selectionSet, fragments, visitField, depth = 0, visited = new Set()) => {
  if (!selectionSet) {
    return;
  }

  for (const selection of selectionSet.selections) {
    if (selection.kind === Kind.FIELD) {
      visitField(selection, depth + 1);
      walkSelections(selection.selectionSet, fragments, visitField, depth + 1, visited);
      continue;
    }

    if (selection.kind === Kind.INLINE_FRAGMENT) {
      walkSelections(selection.selectionSet, fragments, visitField, depth, visited);
      continue;
    }

    if (selection.kind === Kind.FRAGMENT_SPREAD && !visited.has(selection.name.value)) {
      const fragment = fragments.get(selection.name.value);
      if (fragment) {
        walkSelections(
          fragment.selectionSet,
          fragments,
          visitField,
          depth,
          new Set(visited).add(selection.name.value)
        );
      }
    }
  }
};

const createDepthLimitRule = (maximumDepth) => (context) => ({
  Document(document) {
    const fragments = collectFragments(document);

    for (const operation of document.definitions.filter(
      (definition) => definition.kind === Kind.OPERATION_DEFINITION
    )) {
      let depth = 0;
      walkSelections(operation.selectionSet, fragments, (_field, fieldDepth) => {
        depth = Math.max(depth, fieldDepth);
      });

      if (depth > maximumDepth) {
        context.reportError(
          new GraphQLError(`Query depth ${depth} exceeds the maximum of ${maximumDepth}.`, {
            nodes: operation
          })
        );
      }
    }
  }
});

const createComplexityLimitRule = (maximumComplexity) => (context) => ({
  Document(document) {
    const fragments = collectFragments(document);

    for (const operation of document.definitions.filter(
      (definition) => definition.kind === Kind.OPERATION_DEFINITION
    )) {
      let complexity = 0;
      walkSelections(operation.selectionSet, fragments, () => {
        complexity += 1;
      });

      if (complexity > maximumComplexity) {
        context.reportError(
          new GraphQLError(
            `Query complexity ${complexity} exceeds the maximum of ${maximumComplexity}.`,
            { nodes: operation }
          )
        );
      }
    }
  }
});

const createValidationRules = ({ maxDepth, maxComplexity }) => [
  createDepthLimitRule(maxDepth),
  createComplexityLimitRule(maxComplexity)
];

module.exports = {
  createComplexityLimitRule,
  createDepthLimitRule,
  createValidationRules
};
