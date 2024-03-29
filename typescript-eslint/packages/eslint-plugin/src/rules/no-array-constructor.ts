import type { TSESTree } from '@typescript-eslint/utils';
import { AST_NODE_TYPES } from '@typescript-eslint/utils';
import { getSourceCode } from '@typescript-eslint/utils/eslint-utils';

import { createRule, isOptionalCallExpression } from '../util';

export default createRule({
  name: 'no-array-constructor',
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Disallow generic `Array` constructors',
      recommended: 'recommended',
      extendsBaseRule: true,
    },
    fixable: 'code',
    messages: {
      useLiteral: 'The array literal notation [] is preferable.',
    },
    schema: [],
  },
  defaultOptions: [],
  create(context) {
    /**
     * Disallow construction of dense arrays using the Array constructor
     * @param node node to evaluate
     */
    function check(
      node: TSESTree.CallExpression | TSESTree.NewExpression,
    ): void {
      if (
        node.arguments.length !== 1 &&
        node.callee.type === AST_NODE_TYPES.Identifier &&
        node.callee.name === 'Array' &&
        !node.typeArguments &&
        !isOptionalCallExpression(node)
      ) {
        context.report({
          node,
          messageId: 'useLiteral',
          fix(fixer) {
            if (node.arguments.length === 0) {
              return fixer.replaceText(node, '[]');
            }
            const fullText = getSourceCode(context).getText(node);
            const preambleLength = node.callee.range[1] - node.range[0];

            return fixer.replaceText(
              node,
              `[${fullText.slice(preambleLength + 1, -1)}]`,
            );
          },
        });
      }
    }

    return {
      CallExpression: check,
      NewExpression: check,
    };
  },
});
