/* eslint-env mocha */
/* eslint-disable func-names, prefer-arrow-callback */

import { chai } from 'meteor/practicalmeteor:chai'
const expect = chai.expect

// Import and rename a variable exported by denormalization.js.
import { Denormalize, AUTOFORM_IS_ACTIVE } from 'meteor/thebarty:denormalization'
Denormalize.Debug = true

// import { UseCase } from './projects_list_standalone_component.js'

// needed for simple test
const aCollection = new Mongo.Collection('acollection')


// ===========================================
// POSTS & COMMENTS: ONE-TO-MANY RELATIONSHIP

// ===========================================
// EXAMPLE 1: "ONE-TO-MANY FLAT MODE"-Approach
//  for a "one-to-many"-relation between Posts and Comments
//  "Comments" are stored into 2 fields:
//
//  From the "Comment"-perspective:
//   1 Comment is assigned to 1 Post
//
//  From the "Posts"-perspective:
//   1 Post can have Many comments
//
//  In the first example, we use "FLAT-MODE" within "Posts"-collection
//   and denormalize related "Comments" in 2 fields,
//   attached strait to the root like this:
//   1) "Posts.commentIds": a writable array (``type: [String]``}) that references
//       the _id of the related Comments.
//   2) "Posts.commentInstances": read-only field that contains
//       the full-denormalized instance of the related Comment.
//
// FIXTURES
const PostsSimple = new Mongo.Collection('postssimple')
const CommentsSimple = new Mongo.Collection('commentssimple')
const AuthorsSimple =  new Mongo.Collection('authorssimple')

const UpdateCreatedSchema = new SimpleSchema({
  // CREATED && UPDATED
  createdAt: {
    type: Date,
    autoValue: function() {
      if (this.isInsert) {
        return new Date;
      } else if (this.isUpsert) {
        return {$setOnInsert: new Date};
      } else {
        this.unset();  // Prevent user from supplying their own value
      }
    },
  },
  updatedAt: {
    type: Date,
    autoValue: function() {
      return new Date();  // always add date
    },
  },
})

AuthorsSimple.attachDenormalizedSchema([
  // MERGE 2 Schemas is supported
  {
    name: {
      type: String,
    },
    // RELATIONSHIPN: "Foreign-Key" (ONE_TO_MANY reference field)
    // .. from Author-perspectve
    //    1 Author can have Many comments
    postIds: {
      // WRITABLE field
      type: [String],
      optional: true,
      denormalize: {
        relation: Denormalize.RELATION_ONE_TO_MANY,
        relatedCollection: PostsSimple,
        relatedReference: 'authorId',
        pickAttributes: ['post'],
        extendCacheFieldBy: {
          label: 'Author denormalized Instance',
        }
      },
    },
    // NOTE:
    // "postInstance"-property will be generated
  },
  UpdateCreatedSchema
])

CommentsSimple.attachDenormalizedSchema({
  comment: {
    type: String,
  },
  // RELATION: "Foreign-Key" (RELATION_MANY_TO_ONE reference field)
  // .. from Comments-perspectve
  //    Many Comment are assigned to 1 Post
  // .. or in other words (from the Post-perspective):
  //    1 Post can have Many comments. See "Posts"-Collection
  postId: {
    // WRITABLE field
    type: String,
    optional: true,
    denormalize: {
      relation: Denormalize.RELATION_MANY_TO_ONE,
      relatedCollection: PostsSimple,
      relatedReference: 'commentIds',
      pickAttributes: ['post'],
      extendCacheFieldBy: {
        // the content of this object is attached to the generated instance-field
        label: 'Posts Instance',
        // keep for reference - this needs to work, when AutoForm is installed
        // autoform: {
        //   // TEST that omit is true, still there
        //   type: 'select-checkbox',
        // },
      }
    },
  },
  // NOTE:
  // "postCache"-property will be generated
})

PostsSimple.attachDenormalizedSchema({
  post: {
    type: String,
  },

  // RELATION: ONE-TO-MANY (SIMPLE FLAT-MODE)
  //  1 Post can have Many comments.
  commentIds: {
    // WRITABLE array-field
    // type: [String],  // will be set
    optional: true,
    denormalize: {
      relation: Denormalize.RELATION_ONE_TO_MANY,
      relatedCollection: CommentsSimple,
      relatedReference: 'postId',
      pickAttributes: ['comment'],
    },
  },
  // "commentCache.instances"-property will be generated

  // RELATION: MANY-TO-ONE
  //  Many Posts can belong to 1 Author.
  authorId: {
    // WRITABLE array-field
    // type: String,  // will be set
    optional: false,  // mandatory
    denormalize: {
      relation: Denormalize.RELATION_MANY_TO_ONE,
      relatedCollection: AuthorsSimple,
      relatedReference: 'postIds',
      pickAttributes: ['name'],
    },
  },
  // "authorCache"-property will be generated
})

// TESTS
if (Meteor.isServer) {
  describe('Denormalization works', function () {
    // BASIC IMPORT TEST
    it('basic import works', function () {
      expect(Denormalize).to.be.defined
    })

    it('CollectionHooks-package allows us to instanciate multiple hook-functions. All hooks defined hook-functions will be run.', function () {
      const aSchema = new SimpleSchema({
        test: {
          type: String,
        },
        insertHook1: {
          type: String,
          optional: true,
        },
        insertHook2: {
          type: String,
          optional: true,
        },
      })
      aCollection.attachSchema(aSchema)
      // define 2 hooks to test if they are both run
      aCollection.after.insert(function (userId, doc) {
        aCollection.update(this._id, { $set: { insertHook1: 'insertHook1 was here' } })
      })
      aCollection.after.insert(function (userId, doc) {
        aCollection.update(this._id, { $set: { insertHook2: 'insertHook2 was here' } })
      })
      // do an insert, to trigger the hooks
      const docId = aCollection.insert({
        test: 'test insert'
      })
      // check
      const doc = aCollection.findOne(docId)
      expect(doc.test).to.equal('test insert')
      expect(doc.insertHook1).to.equal('insertHook1 was here')
      expect(doc.insertHook2).to.equal('insertHook2 was here')
    })

    it('_getCacheNameFromReferenceKey() works as expeced', function () {
      expect(Denormalize._getCacheNameFromReferenceKey('postIds')).to.equal('postCache')
      expect(Denormalize._getCacheNameFromReferenceKey('posts.$.postIds')).to.equal('posts.$.postCache')
    })

    it('_getModeForKey() works as expeced', function () {
      expect(Denormalize._getModeForKey('postIds')).to.equal(Denormalize.MODE_FLAT)
      expect(Denormalize._getModeForKey('posts.$.postIds')).to.equal(Denormalize.MODE_EMBEDDED)
    })

    it('generateSimpleSchema-function will define correct defaults', function () {
      // TEST: simple schema WITHOUT overwrite
      const schema = Denormalize.generateSimpleSchema(
        {
          postId: {
            type: String,
            optional: true,
            denormalize: {
              relation: Denormalize.RELATION_MANY_TO_ONE,
              relatedCollection: CommentsSimple,
              relatedReference: 'postId',
              pickAttributes: ['post'],
              extendCacheFieldBy: {
                label: 'Posts Instance',
                autoform: {
                  type: 'select-checkbox',
                },
              }
            },
          },
        },
        true  // AUTOFORM_IS_ACTIVE
      )
      expect(schema).to.be.defined
      expect(schema.postId.type).to.equal(String)
      expect(schema.postCache.label).to.equal('Posts Instance')
      expect(schema.postCache.autoform.type).to.equal('select-checkbox')
      expect(schema.postCache.autoform.omit).to.equal(true)

      // TEST: schema WITH OVERWRITE in "autoform.omit"
      const schema2 = Denormalize.generateSimpleSchema(
        {
          postId: {
            // type: String,  // this will be set
            optional: true,
            denormalize: {
              relation: Denormalize.RELATION_MANY_TO_ONE,
              relatedCollection: CommentsSimple,
              relatedReference: 'postId',
              pickAttributes: ['post'],
              extendCacheFieldBy: {
                label: 'Posts Instance',
                autoform: {
                  type: 'select-checkbox',
                  omit: 'overwrite standard',
                },
              }
            },
          },
        },
        true  // AUTOFORM_IS_ACTIVE
      )
      expect(schema2).to.be.defined
      expect(schema2.postId.type).to.equal(String)
      expect(schema2.postCache.label).to.equal('Posts Instance')
      expect(schema2.postCache.autoform.type).to.equal('select-checkbox')
      expect(schema2.postCache.autoform.omit).to.equal('overwrite standard')

      // TEST: simple schema type [String]
      const schema3 = Denormalize.generateSimpleSchema(
        {
          postId: {
            // type: String, // should be [String]
            optional: true,
            denormalize: {
              relation: Denormalize.RELATION_ONE_TO_MANY,
              relatedCollection: PostsSimple,
              relatedReference: 'authorId',
              pickAttributes: ['post'],
              extendCacheFieldBy: {
                label: 'Author denormalized Instance',
              },
            },
          },
        },
        false  // AUTOFORM_IS_ACTIVE
      )
      expect(schema3).to.be.defined
      expect(schema3.postId.type).to.deep.equal([String])
      expect(schema3.postCache.label).to.equal('Author denormalized Instance')
      expect(schema3.postCache.autoform).to.be.undefined
    })

    it('_validateDenormalizedSettings-function will work as expected', function () {
      const schema = {
        postId: {
          type: String,
          optional: true,
          denormalize: {
            relation: Denormalize.RELATION_MANY_TO_ONE,
            relatedCollection: CommentsSimple,
            relatedReference: 'postIdssss',
          },
        },
      }
      expect(() => {
        Denormalize._validateDenormalizedSettings(schema, 'postId')
      }).to.throw()

      const schema2 = {
        postId: {
          type: String,
          optional: true,
          denormalize: {
            relation: Denormalize.RELATION_MANY_TO_ONE,
            relatedCollection: CommentsSimple,
            relatedReference: 'postId',
          },
        },
      }
      expect(() => {
        Denormalize._validateDenormalizedSettings(schema2, 'postId')
      }).to.not.throw()
    })

    it('Example 1 - Szenario 1 works', function () {
      // Init
      AuthorsSimple.remove({})
      CommentsSimple.remove({})
      PostsSimple.remove({})

      // Scenario
      // 1) insert a new post
      // 2) insert a new comment and assign it to post
      const authorId = AuthorsSimple.insert({
        name: 'author1',
      })
      const postId = PostsSimple.insert({
        authorId,
        post: 'post 1',
      })
      const commentId = CommentsSimple.insert({
        comment: 'comment 1',
        postId: postId,
      })

      // Test: did it work?
      const author = AuthorsSimple.findOne(authorId)
      const post = PostsSimple.findOne(postId)
      const comment = CommentsSimple.findOne(commentId)

      // authors
      expect(author.postIds).to.deep.equal([postId])
      expect(author.postCache.instances.length).to.equal(1)
      expect(author.postCache.instances[0].post).to.equal('post 1')

      // comments
      expect(comment.postId).to.equal(postId)
      expect(comment.postCache.post).to.equal('post 1')

      // posts
      expect(post.authorId).to.equal(authorId)
      expect(post.authorCache.name).to.equal('author1')
      expect(post.commentIds).to.deep.equal([commentId])
      expect(post.commentCache.instances.length).to.equal(1)
      expect(post.commentCache.instances[0].comment).to.equal('comment 1')
    })

    it('Example 1 - Szenario 2 works ', function () {
      // Init
      AuthorsSimple.remove({})
      CommentsSimple.remove({})
      PostsSimple.remove({})

      // Scenario
      // 1) insert a comment
      // 2) insert a author
      // 3) insert a post
      const commentId = CommentsSimple.insert({
        comment: 'comment 1',
      })
      const authorId = AuthorsSimple.insert({
        name: 'author1',
      })
      const postId = PostsSimple.insert({
        authorId,
        post: 'post 1',
        commentIds: [
          commentId,
        ]
      })

      // Test: did it work?
      const author = AuthorsSimple.findOne(authorId)
      const post = PostsSimple.findOne(postId)
      const comment = CommentsSimple.findOne(commentId)

      // authors
      expect(author.postIds).to.deep.equal([postId])
      expect(author.postCache.instances.length).to.equal(1)
      expect(author.postCache.instances[0].post).to.equal('post 1')

      // comments
      expect(comment.postId).to.equal(postId)
      expect(comment.postCache.post).to.equal('post 1')

      // posts
      expect(post.authorId).to.equal(authorId)
      expect(post.authorCache.name).to.equal('author1')
      expect(post.commentIds).to.deep.equal([commentId])
      expect(post.commentCache.instances.length).to.equal(1)
      expect(post.commentCache.instances[0].comment).to.equal('comment 1')
    })

    xit('Example 1 - Szenario 3 works ', function () {
      // Init
      AuthorsSimple.remove({})
      CommentsSimple.remove({})
      PostsSimple.remove({})

      // Scenario
      // 1) insert a comment
      // 2) insert a author
      // 3) insert a post
      const commentId = CommentsSimple.insert({
        comment: 'comment 1',
      })
      const authorId = AuthorsSimple.insert({
        name: 'author1',
      })
      const postId = PostsSimple.insert({
        authorId,
        post: 'post 1',
        commentIds: [
          commentId,
        ]
      })
      // this is exacly the scenario 2.
      //  what if we now create a second post2
      //  and assign the same comment (that belongs to post1) to it?
      const postId2 = PostsSimple.insert({
        authorId,
        post: 'post 2',
        commentIds: [
          commentId,
        ]
      })

      // Test: did it work?
      const author = AuthorsSimple.findOne(authorId)
      const post = PostsSimple.findOne(postId)
      const post2 = PostsSimple.findOne(postId2)
      const comment = CommentsSimple.findOne(commentId)

      // authors
      expect(author.postIds).to.deep.equal([postId])
      expect(author.postCache.instances.length).to.equal(1)
      expect(author.postCache.instances[0].post).to.equal('post 2')

      // comments
      expect(comment.postId).to.equal(postId2)
      expect(comment.postCache.post).to.equal('post 2')

      // posts
      // expect comment to be removed!!!
      expect(post.authorId).to.equal(authorId)
      expect(post.authorCache.name).to.equal('author1')
      expect(post.commentIds).to.deep.equal([])
      expect(post.commentCache.instances.length).to.equal(0)

      // expect comment to be added!!!
      expect(post2.authorId).to.equal(authorId)
      expect(post2.authorCache.name).to.equal('author1')
      expect(post2.commentIds).to.deep.equal([commentId])
      expect(post2.commentCache.instances.length).to.equal(1)
      expect(post2.commentCache.instances[0].comment).to.equal('comment 1')
    })

    it('_ensureArrayProperty works as expected', function () {
      const obj1Source = {
      }
      const obj1Expected = {
        prop: [],
      }
      expect(Denormalize._ensureArrayProperty(obj1Source, 'prop')).to.deep.equal(obj1Expected)

      const obj2Source = {
        prop: [1,2,3]
      }
      const obj2Expected = {
        prop: [1,2,3]
      }
      expect(Denormalize._ensureArrayProperty(obj2Source, 'prop')).to.deep.equal(obj2Expected)

      const obj3Source = {
        prop: 'String'
      }
      expect(() => {
        Denormalize._ensureArrayProperty(obj3Source, 'prop')
      }).to.throw()

      const obj4Source = {
        prop: [1,2,3],
      }
      const obj4Expected = {
        prop: [1,2,3],
        prop2: [],
      }
      expect(Denormalize._ensureArrayProperty(obj4Source, 'prop2')).to.deep.equal(obj4Expected)
    })

    it('_ensureCacheInstancesProperty works as expected', function () {
      const obj1Source = {
      }
      const obj1Expected = {
        propCache: {
          instances: [],
        },
      }
      expect(Denormalize._ensureCacheInstancesProperty({
        doc: obj1Source,
        cacheName: 'propCache' })
      ).to.deep.equal(obj1Expected)

      const obj2Source = {
        propCache: {
        },
      }
      const obj2Expected = {
        propCache: {
          instances: [],
        },
      }
      expect(() => {
        Denormalize._ensureCacheInstancesProperty({
        doc: obj2Source,
        cacheName: 'propCache' })
      }).to.throw()

      const obj3Source = {
        propCache: {
          instances: [1,2],
        },
      }
      const obj3Expected = {
        propCache: {
          instances: [1,2],
        },
      }
      expect(Denormalize._ensureCacheInstancesProperty({
        doc: obj3Source,
        cacheName: 'propCache' })
      ).to.deep.equal(obj3Expected)
    })

  })
}


// EXAMPLE 2: "ONE-TO-MANY EMBEDDED-ARRAY"-APPROACH
//
// "comments" are saved in an array that contains extra data,
//   p.e. "order" of comments.
//   * "Posts.[comments]" is an array of objects
//   * "Posts.[comments].commentId": a writable field (``type: String``}) that references
//      the _id of the related Comment.
//   * "Posts.[comments].commentInstance": read-only field that contains
//      the full-denormalized instance of the related Comment.
//   * "Posts.[comments].*" can be used to store extra data,
//      p.e. the "order" of comments. This is the reason why we are in "EMBEDDED-ARRAY"-mode
/*
const PostsEnhanced   = new Mongo.Collection('postsenhanced')
const CommentsEnhanced = new Mongo.Collection('commentsenhanced')
CommentsEnhanced.Schema  = new SimpleSchema({
  comment: {
    type: String,
  },
  // RELATION: "Foreign-Key" (ONE-TO-MANY reference field)
  // .. 1 Comment is assigned to 1 Post
  //    or in other words (from the Post-perspective):
  //    1 Post can have Many comments. See "Posts"-Collection
  postId: {
    // WRITABLE field
    type: String,
    optional: true,
  },
  postInstance: {
    // READ field instances of related Post
    type: String,
    optional: true,
    blackbox: true,
    autoValue: function () {
      // return Collection2Helper.returnAutoValueForFieldOneToMany({
      //   context: this,
      //   sourceFieldIds: 'productIds',
      //   sourceFieldInstance: 'products',
      //   fieldsToOmit: ['categories', 'categoryIds'],
      //   collection: Products.Collection,
      // })
    },
  },
})
PostsEnhanced.Schema = new SimpleSchema({
  content: {
    type: String,
  },
  comments: {
    // Container for comments
    type: [Object],
    optional: true,
  },
  'comments.$.commentId': {
    // WRITABLE field
    type: String,
    optional: false,
    denormalize: {
      relation: RELATION_ONE_TO_MANY,
      relatedCollection: PostsSimple,
      pickAttributes: ['post'],
      extendCacheFieldBy: {
        // MERGE INTO FLAT
      }
    },
  },
  'comments.$.instance': {
    // READ-only instances of Comments
    type: String,
    optional: false,
  },
  // extra data
  'comments.$.order': {
    // extra data
    type: String,
    optional: false,
  },
})
*/

// TODO: EXAMPLE 3 MANY TO MANY Categories and Products
