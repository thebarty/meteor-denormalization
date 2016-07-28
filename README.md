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

It is designed to be **compatible with the aldeed:ecosystem** ([SimpleSchema](https://github.com/aldeed/meteor-simple-schema), [Collection2](https://github.com/aldeed/meteor-collection2), [AutoForm](https://github.com/aldeed/meteor-autoform), [Tabular](https://github.com/aldeed/meteor-tabular/)).


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


# How does it work?

With the help of this package your collections will store **writable foreign-keys** (in "referenceProperties") and **read-only instances** (in "cacheProperties").

## "referenceProperties": writable foreign-key stores
You design your SimpleSchema by adding **"referenceProperties"** (p.e. ``Post.commentIds``) and adding the ``denormalize: { .. }``-attribute. By definition a referenceProperties is a **writable** property where foreign-keys (``Mongo._ids``) are stored. In the aldeed:ecosystem you could use AutoForm to assign those references.

## "cacheProperties": read-only full-instance stores
For each "referenceProperty" this package will automatically create a **read-only "cacheProperty"**, where full instances of the related doc will be stored.

## A first example

### HAS_MANY relationships

Within your SimpleSchema you define a "denormalize"-relation, p.e. when defining your "Posts"-schema you can hookup "Comments" within the referenceProperty like so:

```js
Posts.attachDenormalizedSchema({
  post: { type: String },

  // 1 comment has 1 post (=referenceProperty)
  commentIds: {
    type: [String],
    optional: true,
    denormalize: {
      relation: Denormalize.RELATION_HAS_MANY,
      relatedCollection: Comments,
      pickAttributes: ['comment'],
    },
  },
  // commentCache will be created (and synced with Comments collection)
})
```
 
Note: You only define the **writable** referenceProperty "Posts.commentIds", where the foreign-keys ``_id`` will be saved as an array of strings (``type: [String]``). An extra **read-only** cacheProperties called ``commentCache`` will be created containing the full comment-instances.

**The package will do 2 things:**

  * it will **attach cacheProperties** to both schemas (``Comments.postCache``and ``Posts.commentCache``). *Why do we do this? Because this way you can still rely on SimpleSchema's validation-logic, p.e. a ``clean()`` will still pass.*
  
  * it will automatically **sync data between both collections** on ``insert``-, ``update``- and ``remove``-commands, by using collection-hooks.

You can now **write to the referenceProperties** (containing the ``_id``) and **read from the cacheProperties**, p.e. like:

```js
// INSERT
const commentId1 = Comments.insert({
  comment: 'comment 1',
})
const commentId2 = Comments.insert({
  comment: 'comment 2',
})
const postId = Posts.insert({
  post: 'post 1',
  commentIds: [
  	commentId1,
  	commentId2,
  ],
})
const post = Posts.findOne(postId)
expect(post.commentCache.instances.length).to.equal(2)
expect(post.commentCache.instances[0].comment).to.equal('comment 1')
expect(post.commentCache.instances[1].comment).to.equal('comment 2')

// UPDATE
Posts.update(postId, { $set: {
  commentIds: [
  	commentId2,
  ],
} })
const postAfterUpdate = Posts.findOne(postId)
expect(postAfterUpdate.commentCache.instances.length).to.equal(1)
expect(postAfterUpdate.commentCache.instances[0].comment).to.equal('comment 2')

// updates on comments will be synced to posts, p.e.
Comments.update(commentId2, { $set: { comment: 'comment 2 NEW' } } )
const postAfterCommentUpdate = Posts.findOne(postId)
expect(postAfterCommentUpdate.commentCache.instances.length).to.equal(1)
expect(postAfterCommentUpdate.commentCache.instances[0].comment).to.equal('comment 2 NEW')

// REMOVE on comments will be synced
Comments.remove(commentId2)
const postAfterCommentRemove = Posts.findOne(postId)
expect(postAfterCommentUpdate.commentCache.instances.length).to.equal(0)
```

### HAS_ONE relationships

This alone will denormalize "Posts"-documents within their related Comments and keep their data in sync. In the "Comments"-collection you could now denormalize related "Posts", like this:

```js
Comments.attachDenormalizedSchema({
  comment: { type: String },

  // 1 comment has 1 post (=referenceProperty)
  postId: {
    type: String,
    optional: false,
    denormalize: {
      relation: Denormalize.RELATION_HAS_ONE,
      relatedCollection: Posts,
      pickAttributes: ['post'],
    },
  },
  // postCache will be created (and synced with Posts collection)
})
```

``Comments.postId`` is the referenceProperty you can write to. An extra cacheProperties called ``Comments.postCache`` will be created for you containing the full comment-instances.

**You can now read and write to the collection like:**

```js
// INSERT
const postId1 = Posts.insert({
  post: 'post 1',
})
const postId2 = Posts.insert({
  post: 'post 2',
})
const commentId1 = Comments.insert({
  postId: postId1,
  comment: 'comment 1',
})

// INSERT
const comment = Comments.findOne(commentId1)
expect(comment.postCache.post).to.equal('post 1')

// UPDATE
Comments.update(commentId1, { $set: { postId: postId2 } })
const comment = Comments.findOne(commentId1)
expect(comment.postCache.post).to.equal('post 2')
// .. this useCase has more details than shown here: when both collections have a denormalization attached, then the comment will also be removed from referenceProperty in post1.

// REMOVES
Denormalize.validateAndExecute(() => {
	Posts.remove(postId1)
	// make sure that data is consistent
	// p.e. it might happen that a Comment NEEDS to have a Post
	// assigned. Then we could remove the Post, but when removing
	// the reference from the Comment, there will be an error thrown.
	// In this case, we will "rollback" the ``Posts.remove()`` and
	// throw an validationError.
})
const commentAfterRemove = Comments.findOne(commentId1)
expect(commentAfterRemove.postId).to.be.undefined
expect(commentAfterRemove.postCache).to.be.undefined
```

### HAS_ONE relationships - "embedded-array" mode

If you want to go more advanced you could even define HAS_ONE-relations within an embedded array, in order to store more related information. P.e. if you want to store the order of the comment, instead of stayin "flat", you could use the **"embedded-array" mode**:

```js
Comments.attachDenormalizedSchema({
  comment: { type: String },

	posts: {
		type: [Object],
		label: 'Related Posts',
	},
	// "embedded-array" mode: embedd denormalized data in array
  // 1 comment has 1 post (=referenceProperty)
  'posts.$.postId': {
    type: String,
    optional: false,
    denormalize: {
      relation: Denormalize.RELATION_HAS_ONE,
      relatedCollection: Posts,
      pickAttributes: ['post'],
    },
  },
  // 'posts.$.postCache' will be created (and synced with Posts collection)

  // store more infos within the embedded array
  'posts.$.order': {
    type: Number,
    optional: false,
  },
})
```

# Chained denormalisations are currently NOT possible - WHO knows how to do it?

Syncing 2 collections using collection-hooks package is possible by registering hooks plus using the ``Collection.direct.*`` commands within the hooks to prevent infinite-loops.

BUT - how about implementing "chained denormalizations"?

This is an example to demonstrate what I mean:

Lets say we have "Posts", "Comments" and "Guests". A post stores comments, a comment stores its post and the guest who wrote it. So the "name" of the Guest is actually available in 2 places:
 1. ``Comment.guestCache.name``
 2. ``Post.commentCache[].guestCache.name``

[[https://github.com/thebarty/meteor-denormalization/blob/master/docs/img/chained_denormalization_example.png]]

## The challange

What if a ``Guest.name`` gets updated, or even removed? The sync to the related Comment will work, BUT the ``Post.commentCache`` will NOT know about it using the current collection-hooks approach.

How could we solve this issue? First ideas:

Instead of using ``Collection.direct.insert|update|remove``-commands within our hooks to prevent infintive hook-loops, we could use ``Collection.direct.insert|update|remove``-commands to pass thru chained denormalization. 

In order to prevent infinite loops, we would have to simple prevent the original caller-hook to be called again, p.e. within ``Comments.after.update``-hook we could trigger ALL other hooks, except ``Guest.hooks``. In order to do this, we need to be able to pass an parameter from an Mongo-command to the attached hook.

It would be great if we could do this - BUT this is NOT possible right now, right? I have created a topic within the collection-hooks package on this: https://github.com/matb33/meteor-collection-hooks/issues/192

**Do you have an idea how to do this? Please let use know!**

```js
// pass a parameter to on update that I can then read in hook
Comments.update(id, { $set: { something: 'new' } }, 
	{ calledFromWithinHook: Guest } )

// read this parameter in hook, p.e.
Collection.after.update( (calledFromWithinHook) => {
	// run any hooks EXCEPT the ones being related to calledFromWithinHook
})
```

## The current solution: do NOT support it

An easy workaround for version 1 of this package would be to simply NOT support "chained"-denormalizations. This means, that we need to REMOVE all referenceProperties and cacheProperties within cached documents, p.e. ``Post.commentCache[]`` will simply NOT contain ``guestCache`` and ``guestId``.

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
