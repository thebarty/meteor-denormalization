# WARNING: THIS IS WORK IN PROGRESS - THIS IS TOTALLY UNUSABLE RIGHT NOW!!!

**WARNING: THIS IS WORK IN PROGRESS - THIS IS TOTALLY UNUSABLE RIGHT NOW!!!**
**WARNING: THIS IS WORK IN PROGRESS - THIS IS TOTALLY UNUSABLE RIGHT NOW!!!**
**WARNING: THIS IS WORK IN PROGRESS - THIS IS TOTALLY UNUSABLE RIGHT NOW!!!**
**WARNING: THIS IS WORK IN PROGRESS - THIS IS TOTALLY UNUSABLE RIGHT NOW!!!**
**WARNING: THIS IS WORK IN PROGRESS - THIS IS TOTALLY UNUSABLE RIGHT NOW!!!**
**WARNING: THIS IS WORK IN PROGRESS - THIS IS TOTALLY UNUSABLE RIGHT NOW!!!**


# Denormalization-Helper for Meteor SimpleSchema Collection2

I LOVE the aldeed:ecosystem!!! SimpleSchema + Collection2 + Autoform+Tabular are GREAT TOOLS for RAPID development. Denormalization speeds things up when reading data and makes your application scalable (?), BUT it also adds complexity and might give you headaches. Actually implementing denormalization is what I found to really slow me down...

This package is THE SOLUTION I came up with to make things easier.

While staying in "SimpleSchema" it gives you tools for the following relations between 2 collections:
 * ONE_TO_MANY
 * MANY_TO_ONE
 * MANY_TO_MANY
The aim is to support denormalization in both directions, so that (if needed) BOTH collections can have the current denormalized data.

```js


```

## How to contribute to this package
Lets make this perfect and collaborate. This is how to set up your local testing environment:
1. run "meteor create whatever; cd whatever; mkdir packages;"
2. copy this package into the packages dir, p.e. "./whatever/packages/denormalization"
3. run tests from the root (/whatever/.) of your project like ``meteor test-packages ./packages/denormalization/ --driver-package practicalmeteor:mocha``
4. develop, write tests, and submit a pull request

## Resources:
 * https://disqus.com/home/discussion/justmeteor/why_we_dont_denormalize_anymore/newest/ interesting read-up. For me the conclusions are: "denormalization" is an performance optimization technique, meaning: When prototyping it might (!!!) make sense to use joins or use this package to speed things up. "The rule should be, go full relational until performance matters, once it does start de-normalizing." The ambivalent concept is that we are using mongo which is advising us to use denormalization.

## Other related packages:
* https://github.com/peerlibrary/meteor-peerdb: perfect and much better than this package, BUT it is NOT compatible with SimpleSchema.
* https://github.com/jeanfredrik/meteor-denormalize: Great api, but does NOT support the UseCases that this package does.
