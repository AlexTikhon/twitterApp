import type { CodegenConfig } from '@graphql-codegen/cli';

const config: CodegenConfig = {
  schema: '../BE/graphql/schema.graphql',
  documents: ['src/graphql/**/*.graphql'],
  generates: {
    'src/generated/graphql.ts': {
      plugins: ['typescript-operations', 'typed-document-node'],
      config: {
        avoidOptionals: true,
        enumsAsTypes: true,
        immutableTypes: true
      }
    }
  },
  hooks: {
    afterAllFileWrite: ['prettier --write']
  }
};

export default config;
