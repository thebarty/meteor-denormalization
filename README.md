**WARNING: THIS IS WORK IN PROGRESS - THIS IS TOTALLY UNUSABLE RIGHT NOW!!!**
**WARNING: THIS IS WORK IN PROGRESS - THIS IS TOTALLY UNUSABLE RIGHT NOW!!!**
**WARNING: THIS IS WORK IN PROGRESS - THIS IS TOTALLY UNUSABLE RIGHT NOW!!!**
**WARNING: THIS IS WORK IN PROGRESS - THIS IS TOTALLY UNUSABLE RIGHT NOW!!!**
**WARNING: THIS IS WORK IN PROGRESS - THIS IS TOTALLY UNUSABLE RIGHT NOW!!!**
**WARNING: THIS IS WORK IN PROGRESS - THIS IS TOTALLY UNUSABLE RIGHT NOW!!!**


*This is a first draft of how the api in version 1.0 could look like. I am looking for your feedback on this. The package is NOT YET written nor released!*

# Meteor Denormalization for SimpleSchema & Collection2

*thebarty:denormalization*

Outlook: This package makes denormalization of your Mongo collections easy for you: Simply define your denormalizations within your [SimpleSchema](https://github.com/aldeed/meteor-simple-schema) and let it do all the magic. "one-to-one"-, "one-to-many"-, "many-to-one"- and "many-to-many"-relations are supported out-of-the-box thru our "HAS_ONE"- and "HAS_MANY"-relations.

The system will then automatically denormalize the data between the specified collections and keep them in sync on ``insert``-, ``update``- and ``remove``-commands. 

With the help of the included "rollback system" and "bidirectional sync", data-consistency is ensured.

It is designed to be **compatible with the aldeed:ecosystem** ([SimpleSchema](https://github.com/aldeed/meteor-simple-schema), [Collection2](https://github.com/aldeed/meteor-collection2), [AutoForm](https://github.com/aldeed/meteor-autoform), [Tabular](https://github.com/aldeed/meteor-tabular/)).


# Table of Contents

<!-- START doctoc generated TOC please keep comment here to allow auto update -->
<!-- DON'T EDIT THIS SECTION, INSTEAD RE-RUN doctoc TO UPDATE -->


- [Installation](#installation)
- [How does it work?](#how-does-it-work)
  - ["referenceProperties": writable foreign-key stores](#referenceproperties-writable-foreign-key-stores)
  - ["cacheProperties": read-only full-instance stores](#cacheproperties-read-only-full-instance-stores)
  - [A first example](#a-first-example)
    - [HAS_ONE relationships](#has_one-relationships)
    - [HAS_MANY relationships (FLAT mode)](#has_many-relationships-flat-mode)
    - [HAS_MANY relationships (EMBEDDED-ARRAY mode)](#has_many-relationships-embedded-array-mode)
- [Data consistency](#data-consistency)
  - [Rollback system](#rollback-system)
  - [Bidirectional syncing](#bidirectional-syncing)
- [Chained denormalisations? Help needed: How do implement ?](#chained-denormalisations-help-needed-how-do-implement-)
  - [The challange](#the-challange)
  - [The current solution: we do NOT support it](#the-current-solution-we-do-not-support-it)
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

Let's start simple with a "Posts" and "Comments" example: one post can have multiple comments. 1 comment is related to one post.

### HAS_ONE relationships

Within the "Comments"-collection you can denormalize related "Posts", like this:

```js
Comments.attachDenormalizedSchema({
  comment: { type: String },

  // referenceProperty
  postId: {
    type: String,
    optional: false,
    denormalize: {
      relation: Denormalize.HAS_ONE,
      relatedCollection: Posts,
      pickProperties: ['post'],
    },
  },
  // postCache will be created (and synced with Posts collection)
})
```

``Comments.postId`` is the referenceProperty you can write to. An extra cacheProperties called ``Comments.postCache`` will be created for you containing the full comment-instances.

**The package will do 2 things:**

  1. it will **attach cacheProperties** to the schemas (``Comments.postCache``). *Why do we do this? Because this way you can still rely on SimpleSchema's validation-logic, p.e. a ``clean()`` will still pass.*
  
  2. it will automatically **sync data** from the "Comments"- to the "Posts"-collection on ``insert``-, ``update``- and ``remove``-commands, by using collection-hooks. 

The cache (``Comments.commentCache``) will renew...
  * when you edit (insert|update|remove) ``Comments.commentIds``, p.e. like ``Comments.update(id, {$set: { commentIds: [postId] }})``
  * when a related "Post" is edited (update|remove), p.e. via ``Post.update(id, {$set: {post: 'new test'}})``.

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

### HAS_MANY relationships (FLAT mode)

Defining your "Posts"-schema you can hookup "Comments" within the referenceProperty like so:

```js
Posts.attachDenormalizedSchema({
  post: { type: String },

  // referenceProperty
	commentIds: {
    type: [String],
    optional: true,
    denormalize: {
      relation: Denormalize.HAS_MANY,
      relatedCollection: Comments,
      pickProperties: ['comment'],
    },
  },
  // commentCache will be created (and synced with Comments collection)
})
```
 
Note: You only define the **writable** referenceProperty "Posts.commentIds", where the foreign-keys ``_id`` will be saved as an array of strings (``type: [String]``). An extra **read-only** cacheProperties called ``commentCache`` will be created containing the full comment-instances.

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

### HAS_MANY relationships (EMBEDDED-ARRAY mode)

If you need to store additional data within an HAS_MANY-relation, you can use the EMBEDDED-ARRAY mode. P.e. if you want to store the order of the comment, do it like this:

```js
Posts.attachDenormalizedSchema({
  post: { type: String },

	comments: {
		type: [Object],
		label: 'Comments in Post',
	},
	// "embedded-array" mode: embedded denormalized data in array
  // referenceProperty
  'comments.$.commentId': {
    type: String,
    optional: false,
    denormalize: {
      relation: Denormalize.HAS_MANY,
      relatedCollection: Comments,
      pickProperties: ['comment'],
    },
  },
  // 'comments.$.postCache' will be created (and synced with Posts collection)

  // store more infos within the embedded array
  'comments.$.order': {
    type: Number,
    optional: false,
  },
})
```

# Data consistency

This package only makes sense when we can guarantee that data is kept consistent.

## Cascade Delete vs. Validation via Rollback

The user should be able to select the cascade update policy like:

```
	commentIds: {
    type: [String],
    optional: true,
    denormalize: {
      relation: Denormalize.HAS_MANY,
      relatedCollection: Comments,
      cascadeDelelte: Denormalize.CASCADE_DELETE || Denormalize.CASCADE_ESCALATE
    },
  },
```

 * Denormalize.CASCADE_ESCALATE will throw an Error an trigger a rollback
 * Denormalize.CASCADE_DELETE will delete the related documents

This should be evaluated in detail.

## Rollback system

There are scenarios when we need some kind of transaction/rollback-system, that can rollback changes when an error occurs, p.e. in a related hook. 

This can easily happen when defining referenceProperty as ``optional: false`` as the following "REMOVE"- and "UPDATE"-scenario demonstrates.

**REMOVE scenario**

For example: if a comment needs to have a post attached and we **remove** a post which is assigned in a comment: then an error needs to be thrown stating that the post can NOT be removed because a comment is still relating to it.

**UPDATE scenario**

The above scenario also should throw an error when you try to remove a comment from its referenceProperty via an **update**. Within the hooks we would then try to remove the postId from the ``comment.postId``, which would throw an Error, because it always needs a post attached (``option: false``). Thru our transaction-system all changes (including the ones on Post) should be rolled back and an error should be thrown.

**Example Code**

```js
Comments.attachDenormalizedSchema({
  comment: { type: String },
  postId: {
    type: String,
    optional: false,  // MANDATORY = we need rollback support(!!!)
    denormalize: {
      relation: Denormalize.HAS_ONE,
      relatedCollection: Posts,
    },
  },
})

Posts.attachDenormalizedSchema({
  post: { type: String },
  commentIds: {
    type: [String],
    optional: true,
    denormalize: {
      relation: Denormalize.HAS_MANY,
      relatedCollection: Comments,
    },
  },
})
// fixtures
const postId1 = Posts.insert({
  post: 'post 1',
})
const commentId1 = Comments.insert({
  postId: postId1,
  comment: 'comment 1',
})

// an error should be thrown when trying to remove the post
expect(() => {
	Denormalize.validateAndExecute(() => {
		Post.remove(postId1) 
		// the above command will go thru,
		// BUT ``Comments.update({$unset: { comments.postId: 1 } })``
		// will throw an error. we need to rollback
	})
}).to.throw()
// validate rollback
expect(Posts.findOne(postId1)).to.be.defined
expect(Comments.findOne(commentId1).postCache.post).to.equal('comment 1')

// an error should be thrown when trying to remove the reference
expect(() => {
	Denormalize.validateAndExecute(() => {
		Post.update(postId1, { $set: { commentIds: [] } })		
	})
}).to.throw()
// validate rollback
expect(Posts.findOne(postId1)).to.be.defined
expect(Comments.findOne(commentId1).postCache.post).to.equal('comment 1')
```


## Bidirectional syncing

This package supports bidirectional linking, p.e. "Comments" contain denormalized posts, "Posts" contain denormalized comments.

In this scenario we need to keep the relations in sync within both collection:
 * if an update is made on collection "Posts", then relations in collection "Comments" need to be updated
 * if an update is made on collection "Comments", then relations in collection "Posts" needs to be updated

```js
// Schema definitions INCLUDING bidirectional-sync setting
Comments.attachDenormalizedSchema({
  comment: { type: String },
  postId: {
    type: String,
    optional: true,
    denormalize: {
      relation: Denormalize.HAS_ONE,
      relatedCollection: Posts,
      relatedReferenceProperty: 'commentsIds' // bidirectional setting 
	                                            // (optional), but enables
	                                            // bidirectional syncinc
    },
  },
})

Posts.attachDenormalizedSchema({
  post: { type: String },
  commentIds: {
    type: [String],
    optional: true,
    denormalize: {
      relation: Denormalize.HAS_MANY,
      relatedCollection: Comments,
      relatedReferenceProperty: 'postId' // bidirectional setting 
                                         // (optional), but enables
                                         // bidirectional syncinc
    },
  },
})
// fixtures
const postId = Posts.insert({
  post: 'post 1',
})
// NOTE: we are updating the relation in Comments.postId,
// and expect the bidirectional sync, to search for a "denormalize"-relation
// in Posts field and update the related ``Post.commentIds`` referenceProperty.
const commentId = Comments.insert({
  postId: postId,
  comment: 'comment 1',
})

// expect Post.commentIds to be updated
const post = Posts.findOne(postId)
const comment = Comments.findOne(commentId)
expect(post.commentIds).to.deep.equal([commentId])
expect(post.commentCache.instances[0].comment).to.equal('comment 1')
```

# Chained denormalisations? Help needed: How do implement ?

Syncing 2 collections using collection-hooks package is possible by registering hooks plus using the ``Collection.direct.*`` commands within the hooks to prevent infinite-loops.

BUT - how about implementing "chained denormalizations"?

This is an example to demonstrate what I mean:

Lets say we have "Posts", "Comments" and "Guests". A post stores comments, a comment stores its post and the guest who wrote it. So the "name" of the Guest is actually available in 2 places:
 1. ``Comment.guestCache.name``
 2. ``Post.commentCache[].guestCache.name``

![chained denormalizations](https://github.com/thebarty/meteor-denormalization/blob/master/docs/img/chained_denormalization_example.png)

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

## The current solution: we do NOT support it

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
