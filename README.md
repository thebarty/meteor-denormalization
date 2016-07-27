# WARNING: THIS IS WORK IN PROGRESS - THIS IS TOTALLY UNUSABLE RIGHT NOW!!!

**WARNING: THIS IS WORK IN PROGRESS - THIS IS TOTALLY UNUSABLE RIGHT NOW!!!**
**WARNING: THIS IS WORK IN PROGRESS - THIS IS TOTALLY UNUSABLE RIGHT NOW!!!**
**WARNING: THIS IS WORK IN PROGRESS - THIS IS TOTALLY UNUSABLE RIGHT NOW!!!**
**WARNING: THIS IS WORK IN PROGRESS - THIS IS TOTALLY UNUSABLE RIGHT NOW!!!**
**WARNING: THIS IS WORK IN PROGRESS - THIS IS TOTALLY UNUSABLE RIGHT NOW!!!**
**WARNING: THIS IS WORK IN PROGRESS - THIS IS TOTALLY UNUSABLE RIGHT NOW!!!**


# Meteor Denormalization for SimpleSchema & Collection2

*thebarty:denormalization*

This package makes denormalization of your Mongo collections easy for you: Simply define your denormalizations within your [SimpleSchema](https://github.com/aldeed/meteor-simple-schema) and let it do all the magic. "one-to-one"-, "one-to-many"-, "many-to-one"- and "many-to-many"-relations are supported out-of-the-box.

The package will then automatically denormalize the data between the specified collections and keep them in sync on ``insert``-, ``update``- and ``remove``-commands. 

It is designed to be **compatible the aldeed:ecosystem** ([SimpleSchema](https://github.com/aldeed/meteor-simple-schema), [Collection2](https://github.com/aldeed/meteor-collection2), [AutoForm](https://github.com/aldeed/meteor-autoform), [Tabular](https://github.com/aldeed/meteor-tabular/)).


# Table of Contents

<!-- START doctoc generated TOC please keep comment here to allow auto update -->
<!-- DON'T EDIT THIS SECTION, INSTEAD RE-RUN doctoc TO UPDATE -->


- [Installation](#installation)
- [How does it work? An Introduction](#how-does-it-work-an-introduction)
  - ["referenceProperties": writable foreign-key stores](#referenceproperties-writable-foreign-key-stores)
  - ["cacheProperties": read-only full-instance stores](#cacheproperties-read-only-full-instance-stores)
  - [A first example](#a-first-example)
- [Supported Relationships](#supported-relationships)
  - [ONE-TO-ONE relationships](#one-to-one-relationships)
  - [ONE-TO-MANY relationships](#one-to-many-relationships)
  - [MANY-TO-ONE relationships](#many-to-one-relationships)
  - [MANY-TO-MANY relationships](#many-to-many-relationships)
  - [More examples? Check out the .test-files](#more-examples-check-out-the-test-files)
- [Constribute to this project](#constribute-to-this-project)
  - [Open Questions to the experts (for Version 2.0)](#open-questions-to-the-experts-for-version-20)
  - [Ideas for future releases](#ideas-for-future-releases)
  - [How to contribute to this package](#how-to-contribute-to-this-package)
- [Background Infos](#background-infos)
  - [Why denormalize? Upsides](#why-denormalize-upsides)
  - [Resources](#resources)
  - [Other related packages](#other-related-packages)

<!-- END doctoc generated TOC please keep comment here to allow auto update -->


# Installation

In your Meteor app directory, enter:

```
$ meteor add thebarty:denormalization
```


# How does it work? An Introduction

With the help of this package your collections will store **writable foreign-keys** (in "referenceProperties") and **read-only instances** (in "cacheProperties").

## "referenceProperties": writable foreign-key stores
You design your SimpleSchema by adding **"referenceProperties"** (p.e. ``Post.commentIds``) and adding the ``denormalize: { .. }``-attribute. By definition a referenceProperties is a **writable** property where foreign-keys (``Mongo._ids``) are stored. In the aldeed:ecosystem you could use AutoForm to assign those references.

## "cacheProperties": read-only full-instance stores
For each "referenceProperty" this package will automatically create a **read-only "cacheProperty"**, where full instances of the related doc will be stored.

## A first example

Within your SimpleSchema you define a "denormalize"-relation, p.e. when defining your "Posts"-schema you can hookup "Comments" within the referenceProperty like so:
```js
  // "Posts"-schema definition
  // 1 Post can have Many comments
  commentIds: {  // = referenceProperty
    optional: true,
    denormalize: {
      relation: Denormalize.RELATION_ONE_TO_MANY,
      relatedCollection: Comments,
      relatedReferenceProperty: 'postId',
    },
  }
  // "commentCache" (cacheProperty) will be created automatically
```
 
Note how you only define the referenceProperty "Posts.commentIds", where the foreign-keys ``_id`` will be saved as an array of strings (``type: [String]``). This is the property you can write to. An extra cacheProperties called ``commentCache`` will be created containing the full comment-instances.

In the "Comments"-schema you can now link back to "Posts":
```js
  // "Comment"-schema definition
  // from the "comments"-perspective:
  //  Many Comments can be assigned to 1 Post
  //  so lets store the single reference
  postId: {  // = referenceProperty
    type: String,
    denormalize: {
      relation: Denormalize.RELATION_MANY_TO_ONE,
      relatedCollection: Posts,
      relatedReferenceProperty: 'commentIds',
  	}
  },
  // "postCache" (cacheProperty) will be created automatically
```

The ``Comments.postId``-property is the field you can write to. An extra cacheProperties called ``Comments.postCache`` will be created for you containing the full comment-instances.

**The package will now do the rest of the work for you:**

  * it will **attach cacheProperties** to both schemas (``Comments.postCache``and ``Posts.commentCache``). *Why do we do this? Because this way you can still rely on SimpleSchema's validation-logic, p.e. a ``clean()`` will still pass.*
  
  * it will automatically **sync data between both collections** on ``insert``-, ``update``- and ``remove``-commands, by using collection-hooks.

You can now **write to the referenceProperties** (containing the ``_id``) and **read from the cacheProperties**, p.e. like:

```js
	  // write to the referenceProperties, p.e. "Comments.postId"
      const postId = Posts.insert({
        authorId,
        postText: 'post 1',
      })
      const commentId = Comments.insert({
        commentText: 'comment 1',
        postId: postId,
      })

      const post = Posts.findOne(postId)
      const comment = Comments.findOne(commentId)

      // comments
      expect(comment.postId).to.equal(postId)
      expect(comment.postCache.postText).to.equal('post 1')

      // posts
      expect(post.commentIds).to.deep.equal([commentId])
      expect(post.commentCache.instances.length).to.equal(1)
      expect(post.commentCache.instances[0].commentText).to.equal('comment 1')
```


# Supported Relationships

## ONE-TO-ONE relationships

## ONE-TO-MANY relationships

## MANY-TO-ONE relationships

## MANY-TO-MANY relationships

## More examples? Check out the .test-files


# Constribute to this project

I'd love to hear your feedback on this and get you in the boat.

## Open Questions to the experts (for Version 2.0)
 * How can we improve the code?
 * How can we make this as stable, fast, scalable and secure as possible?
 * What (edge) use-cases are we NOT covering yet, but should be?

## Ideas for future releases
 * Add support to specify "watchFields". CollectionHooks will then only run on ``update``-commands, if a field within "watchFields" was has actually changed - otherwise the related collection will NOT be updated, because it might not be interested in the data-change at all. If no "watchFields" are specified: hooks will ALWAYS run. *In high-performance environments this feature could be used to decrease writes* 
 * Add transaction support for cases, where an error (p.e. an validation-error) occurs during the denormalisation-chain and it is NOT possible to sync data for any reasons. In this case that related collection should stay in-sync and simply thru an Error to let the user know that the operation is NOT possible. We could use this package https://github.com/JackAdams/meteor-transactions?

## How to contribute to this package
Lets make this perfect and collaborate. This is how to set up your local testing environment:
 1. run "meteor create whatever; cd whatever; mkdir packages;"
 2. copy this package into the packages dir, p.e. "./whatever/packages/denormalization"
 3. run tests from the root (/whatever/.) of your project like ``meteor test-packages ./packages/denormalization/ --driver-package practicalmeteor:mocha``
 4. develop, write tests, and submit a pull request


# Background Infos

## Why denormalize? Upsides
 
 Denormalization makes sense in read-heavy apps.

**Why to denormalize? Advantages**
 * You can avoid complex joins. Simply fetch the document and you're done. (*see resource [1]*)
 * It reduces the load on the database and the lookup time for your data (*see resource [1]*)
 * It makes your app scalable (client-side joints might be hard to scale (*see resource [2]*)
 * Because this package makes it easy

## Resources
 * [1] http://justmeteor.com/blog/why-we-dont-denormalize-anymore/ interesting read-up. For me the conclusions are: "denormalization" is an performance optimization technique, meaning: When prototyping it might (!!!) make sense to use joins or use this package to speed things up. "The rule should be, go full relational until performance matters, once it does start de-normalizing." The ambivalent concept is that we are using mongo which is advising us to use denormalization.

## Other related packages
* https://github.com/peerlibrary/meteor-peerdb: great all-in-one solution, but it is NOT compatible with SimpleSchema.
* https://github.com/jeanfredrik/meteor-denormalize: Good api, but does not support all relations that this package does. This package has been a great inspiration though.
