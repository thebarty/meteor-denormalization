Package.describe({
  name: 'thebarty:denormalization',
  version: '0.0.1',
  // Brief, one-line summary of the package.
  summary: '',
  // URL to the Git repository containing the source code for this package.
  git: '',
  // By default, Meteor will default to using README.md for documentation.
  // To avoid submitting documentation, set this field to null.
  documentation: 'README.md'
})

Npm.depends({
  'underscore': '1.8.3',
  'underscore.string': '3.3.4',
  'validate-options': '0.3.0',
})

Package.onUse(function(api) {
  api.versionsFrom('1.3.5.1')
  api.use([
    'check',
    'ecmascript',
    // 'aldeed:autoform@5.8.1',           // TODO: REMOVE
    'aldeed:simple-schema@1.5.3',     // todo check minimal required version
    'aldeed:collection2@2.9.1',       // todo check minimal required version
    'matb33:collection-hooks@0.8.3',  // todo check minimal required version
  ])
  api.mainModule('denormalization.js')
})

Package.onTest(function(api) {
  api.use('thebarty:denormalization')

  // You should also include any packages you need to use in the test code
  api.use([
    'check',
    'ecmascript',
    // 'aldeed:autoform@5.8.1',           // TODO: REMOVE
    'aldeed:collection2',
    'tinytest@1.0.0',
    'test-helpers@1.0.0',
    'underscore@1.0.0',
    'ejson@1.0.0',
    'ordered-dict@1.0.0',
    'random@1.0.0',
    'deps@1.0.0',
    'minimongo@1.0.0',
    'practicalmeteor:mocha',
  ])

  // Finally add an entry point for tests
  api.mainModule('denormalization.tests.js')
})
