# WARNING: THIS IS WORK IN PROGRESS - THIS IS TOTALLY UNUSABLE RIGHT NOW!!!

**WARNING: THIS IS WORK IN PROGRESS - THIS IS TOTALLY UNUSABLE RIGHT NOW!!!**
**WARNING: THIS IS WORK IN PROGRESS - THIS IS TOTALLY UNUSABLE RIGHT NOW!!!**
**WARNING: THIS IS WORK IN PROGRESS - THIS IS TOTALLY UNUSABLE RIGHT NOW!!!**
**WARNING: THIS IS WORK IN PROGRESS - THIS IS TOTALLY UNUSABLE RIGHT NOW!!!**
**WARNING: THIS IS WORK IN PROGRESS - THIS IS TOTALLY UNUSABLE RIGHT NOW!!!**
**WARNING: THIS IS WORK IN PROGRESS - THIS IS TOTALLY UNUSABLE RIGHT NOW!!!**


# Meteor Collection2 Denormalization

*thebarty:denormalization*

This package makes denormalization easy for you: Simply define your denormalizations within your [SimpleSchema](https://github.com/aldeed/meteor-simple-schema) and let it do all the magic. "One-to-many"-, "many-to-one"- and "many-to-many"-relations are supported out-of-the-box.

The package will then automatically denormalize the data between the specified collections and keep them in sync on ``insert``-, ``update``- and ``remove``-commands. 

It is designed to be **compatible the aldeed:ecosystem** ([SimpleSchema](https://github.com/aldeed/meteor-simple-schema), [Collection2](https://github.com/aldeed/meteor-collection2), [AutoForm](https://github.com/aldeed/meteor-autoform), [Tabular](https://github.com/aldeed/meteor-tabular/)).


# Table of Contents

<!-- START doctoc generated TOC please keep comment here to allow auto update -->
<!-- DON'T EDIT THIS SECTION, INSTEAD RE-RUN doctoc TO UPDATE -->


- [Installation](#installation)
- [How does it work? An Introduction](#how-does-it-work-an-introduction)
  - [referenceProperties](#referenceproperties)
  - [cacheProperties](#cacheproperties)
  - [A first example](#a-first-example)
- [Basic Usage](#basic-usage)
  - [ONE-TO-MANY Relationships](#one-to-many-relationships)
  - [MANY-TO-ONE Relationships](#many-to-one-relationships)
  - [MANY-TO-MANY Relationships.](#many-to-many-relationships)
- [Constribute to this project](#constribute-to-this-project)
  - [Open Questions to the experts (for Version 2.0)](#open-questions-to-the-experts-for-version-20)
  - [How to contribute to this package](#how-to-contribute-to-this-package)
- [Background Infos](#background-infos)
  - [Why denormalize?](#why-denormalize)
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
      relatedReference: 'postId',
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
      relatedReference: 'commentIds',
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

## ONE-TO-MANY relationships

## MANY-TO-ONE relationships

## MANY-TO-MANY relationships

## Check out the .test-files for more examples


# Constribute to this project

I'd love to hear your feedback on this and get you in the boat.

## Open Questions to the experts (for Version 2.0)
 * How can we improve the code?
 * How can we make this as stable, fast, scalable and secure as possible?
 * What (edge) use-cases are we NOT covering yet, but should be?
 * How about adding transaction support? maybe thru this package https://github.com/JackAdams/meteor-transactions?

## How to contribute to this package
Lets make this perfect and collaborate. This is how to set up your local testing environment:
 1. run "meteor create whatever; cd whatever; mkdir packages;"
 2. copy this package into the packages dir, p.e. "./whatever/packages/denormalization"
 3. run tests from the root (/whatever/.) of your project like ``meteor test-packages ./packages/denormalization/ --driver-package practicalmeteor:mocha``
 4. develop, write tests, and submit a pull request


# Background Infos

## Why denormalize?
 * When you have a read-heavy app
 * When you want to scale (client-side joints might be hard to scale - see reference)
 * Because this package makes it easy

## Resources
 * https://disqus.com/home/discussion/justmeteor/why-we-dont-denormalize-anymore/newest/ interesting read-up. For me the conclusions are: "denormalization" is an performance optimization technique, meaning: When prototyping it might (!!!) make sense to use joins or use this package to speed things up. "The rule should be, go full relational until performance matters, once it does start de-normalizing." The ambivalent concept is that we are using mongo which is advising us to use denormalization.

## Other related packages
* https://github.com/peerlibrary/meteor-peerdb: great all-in-one solution, but it is NOT compatible with SimpleSchema.
* https://github.com/jeanfredrik/meteor-denormalize: Good api, but does not support all relations that this package does.
