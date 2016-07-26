# WARNING: THIS IS WORK IN PROGRESS - THIS IS TOTALLY UNUSABLE RIGHT NOW!!!

**WARNING: THIS IS WORK IN PROGRESS - THIS IS TOTALLY UNUSABLE RIGHT NOW!!!**
**WARNING: THIS IS WORK IN PROGRESS - THIS IS TOTALLY UNUSABLE RIGHT NOW!!!**
**WARNING: THIS IS WORK IN PROGRESS - THIS IS TOTALLY UNUSABLE RIGHT NOW!!!**
**WARNING: THIS IS WORK IN PROGRESS - THIS IS TOTALLY UNUSABLE RIGHT NOW!!!**
**WARNING: THIS IS WORK IN PROGRESS - THIS IS TOTALLY UNUSABLE RIGHT NOW!!!**
**WARNING: THIS IS WORK IN PROGRESS - THIS IS TOTALLY UNUSABLE RIGHT NOW!!!**

# Meteor Collection2 Denormalization-Toolkit

A denormalization-toolkit that allows you to specify your denormalization-relations (ONE-TO-MANY, MANY-TO-ONE, MANY-TO-MANY) within your SimpleSchema. It will then automatically denormalize the data between the specified collections and keep it in sync on ``insert``-, ``update``- and ``remove``-commands. It is made to be used with the aldeed:ecosystem ([SimpleSchema](https://github.com/aldeed/meteor-simple-schema), [Collection2](https://github.com/aldeed/meteor-collection2), [AutoForm](https://github.com/aldeed/meteor-autoform), [Tabular](https://github.com/aldeed/meteor-tabular/)).

# How does this work?

It is always good to know whats inside - so this is how the magic works:
 1. Within your SimpleSchema you'll define a relation your, p.e. when defining your "Posts"-schema you can hookup "Comments" like so:
```js
  // "Posts"-schema definition
  // 1 Post can have Many comments
  commentIds: {
    optional: true,
    denormalize: {
      relation: Denormalize.RELATION_ONE_TO_MANY,
      relatedCollection: Comments,
      relatedReference: 'postId',
    },
  }
```
 
 Note how you only define the referenceProperty "commentIds", where only the foreign-keys ``_id`` will be saved as an array of string (``type: [String]``).

  2. In the "Comments"-schema you can now link back to "Posts", like so:
```js
  // "Comment"-schema definition
  // from the "comments"-perspective:
  //  Many Comment can be assigned to 1 Post
  //  so lets store the single reference
  postId: {
    type: String,
    denormalize: {
      relation: Denormalize.RELATION_MANY_TO_ONE,
      relatedCollection: Posts,
      relatedReference: 'commentIds',
  	}
  },
```

 3. The package will now do the rest of the work for you:

  * it will attach cacheProperties to both schemas, where the instance(s) of the related docs will be denormalized / stored. This way you can still rely on SimpleSchema's validation-logic, p.e. a ``clean()`` will still pass.
  
  * it will attach hooks to the collections and sync the data.

 4. You can write to the referenceProperties (containing the ``_id``) and read from the cacheProperties, p.e. like:

```js
	  // write to the referenceProperties, p.e. "Comments.postId"
      const postId = Posts.insert({
        authorId,
        post: 'post 1',
      })
      const commentId = Comments.insert({
        comment: 'comment 1',
        postId: postId,
      })

      const post = Posts.findOne(postId)
      const comment = Comments.findOne(commentId)

      // comments
      expect(comment.postId).to.equal(postId)
      expect(comment.postCache.post).to.equal('post 1')

      // posts
      expect(post.commentIds).to.deep.equal([commentId])
      expect(post.commentCache.instances.length).to.equal(1)
      expect(post.commentCache.instances[0].comment).to.equal('comment 1')
```

## Table of Contents

<!-- START doctoc generated TOC please keep comment here to allow auto update -->
<!-- DON'T EDIT THIS SECTION, INSTEAD RE-RUN doctoc TO UPDATE -->


- [Installation](#installation)
- [Basic Usage](#basic-usage)
- [ONE-TO-MANY Relationships](#one-to-many-relationships)
- [MANY-TO-ONE Relationships](#many-to-one-relationships)
- [MANY-TO-MANY Relationships.](#many-to-many-relationships)
- [How to contribute to this package](#how-to-contribute-to-this-package)
- [Open Questions to the experts (for Version 2.0)](#open-questions-to-the-experts-for-version-20)
- [Background Infos](#background-infos)
  - [Why denormalize?](#why-denormalize)
  - [Resources](#resources)
  - [Other related packages](#other-related-packages)

<!-- END doctoc generated TOC please keep comment here to allow auto update -->

## Installation

In your Meteor app directory, enter:

```
$ meteor add thebarty:denormalization
```

## Basic Usage

## ONE-TO-MANY Relationships

## MANY-TO-ONE Relationships

## MANY-TO-MANY Relationships.

## How to contribute to this package
Lets make this perfect and collaborate. This is how to set up your local testing environment:
 1. run "meteor create whatever; cd whatever; mkdir packages;"
 2. copy this package into the packages dir, p.e. "./whatever/packages/denormalization"
 3. run tests from the root (/whatever/.) of your project like ``meteor test-packages ./packages/denormalization/ --driver-package practicalmeteor:mocha``
 4. develop, write tests, and submit a pull request

## Open Questions to the experts (for Version 2.0)
 * How can we improve the code?
 * How can we make this as stable, fast, scalable and secure as possible?
 * What (edge) use-cases are we NOT covering yet, but should be?
 * How about adding transaction support? maybe thru this package https://github.com/JackAdams/meteor-transactions?

## Background Infos

### Why denormalize?
 * When you have a read-heavy app
 * When you want to scale (client-side joints might be hard to scale - see reference)
 * Because this package makes it easy

### Resources
 * https://disqus.com/home/discussion/justmeteor/why-we-dont-denormalize-anymore/newest/ interesting read-up. For me the conclusions are: "denormalization" is an performance optimization technique, meaning: When prototyping it might (!!!) make sense to use joins or use this package to speed things up. "The rule should be, go full relational until performance matters, once it does start de-normalizing." The ambivalent concept is that we are using mongo which is advising us to use denormalization.

### Other related packages
* https://github.com/peerlibrary/meteor-peerdb: great all-in-one solution, but it is NOT compatible with SimpleSchema.
* https://github.com/jeanfredrik/meteor-denormalize: Good api, but does not support all relations that this package does.
