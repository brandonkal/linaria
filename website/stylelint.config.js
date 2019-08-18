module.exports = {
  extends: ['stylelint-config-standard', 'stylelint-config-prettier'],
  rules: {
    'comment-empty-line-before': null,
    'declaration-empty-line-before': null,
    // Fixes for errors in Stylelint rules
    'selector-attribute-brackets-space-inside': null,
    'selector-attribute-operator-space-before': null,
    'selector-attribute-operator-space-after': null,
    'function-whitespace-after': null,
    'declaration-bang-space-before': null,
    'function-name-case': null,
    'no-descending-specificity': null,
    'selector-combinator-space-after': null,
    'selector-combinator-space-before': null,
    'selector-descendant-combinator-no-non-space': null,
    'selector-pseudo-class-parentheses-space-inside': null,
    // From linaria
    'property-no-vendor-prefix': true,
    'string-no-newline': true,
    'value-no-vendor-prefix': true,
    'no-empty-source': null,
    'no-extra-semicolons': null,
    'no-missing-end-of-source-newline': null,
    'selector-pseudo-class-no-unknown': [
      true,
      {
        ignorePseudoClasses: ['global'],
      },
    ],
  },
};
