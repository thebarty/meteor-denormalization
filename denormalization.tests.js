/* eslint-env mocha */
/* eslint-disable func-names, prefer-arrow-callback */

import { chai } from 'meteor/practicalmeteor:chai'
const expect = chai.expect

// Import and rename a variable exported by denormalization.js.
import { Denormalize, AUTOFORM_IS_ACTIVE } from "meteor/thebarty:denormalization";
Denormalize.Debug = true

// import { UseCase } from './projects_list_standalone_component.js'

// ===========================================
// POSTS & COMMENTS: ONE-TO-MANY RELATIONSHIP

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
const PostsSimple = new Mongo.Collection('postssimple')
const CommentsSimple = new Mongo.Collection('commentssimple')

CommentsSimple.attachSchema(Denormalize.simpleSchema({
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
      fieldsToPick: ['post'],
      customOptions: {
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
  /*
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
      relation: Denormalize.RELATION_ONE_TO_MANY,
      relatedCollection: PostsSimple,
      fieldsToPick: ['post'],
      customOptions: {
        // MERGE INTO FLAT
      }
    },
  },
  */
  // 'comments.$.instance': {
  //   // READ-only instances of Comments
  //   type: String,
  //   optional: false,
  // },
  // extra data
  'comments.$.order': {
    // extra data
    type: String,
    optional: false,
  },

  // postInstance: {
  //   // READ field instances of related Post
  //   type: Object,
  //   optional: true,
  //   blackbox: true,
  //   autoValue: function () {
  //     console.log(`autoValue postInstance`)
  //     return Denormalize.getAutoValue({
  //       relation: Denormalize.RELATION_MANY_TO_ONE,
  //       autoValueContext: this,
  //       referenceField: 'postId',
  //       relatedCollection: PostsSimple,
  //       fieldsToPick: ['post'],
  //     })
  //   },
  // },
}))
// CommentsSimple.attachSchema([CommentsSimple.Schema, Denormalize.generateSchema({})])
PostsSimple.Schema = new SimpleSchema({
  post: {
    type: String,
  },
  // RELATION: ONE-TO-MANY (SIMPLE FLAT-MODE)
  //  1 Post can have Many comments.
  commentIds: {
    // WRITABLE array-field
    type: [String],
    optional: true,
    denormalize: {
      relation: Denormalize.RELATION_ONE_TO_MANY,
      relatedCollection: PostsSimple,
      fieldsToPick: ['post'],
      customOptions: {
        // MERGE INTO FLAT
      }
    },
  },
  // commentInstances: {
  //   // READ-only instances of Comments
  //   type: [Object],
  //   optional: true,
  // },
})
PostsSimple.attachSchema(PostsSimple.Schema)

// We are server only
if (Meteor.isServer) {
  describe('Denormalization works', function () {
    // BASIC IMPORT TEST
    it('basic import works', function () {
      expect(Denormalize).to.be.defined
    })

    it('generateSimpleSchema-function works as expected', function () {
      // TEST: simple schema WITHOUG overwrite
      const schema = Denormalize.generateSimpleSchema(
        {
          postId: {
            type: String,
            optional: true,
            denormalize: {
              relation: Denormalize.RELATION_MANY_TO_ONE,
              relatedCollection: new Object(),
              fieldsToPick: ['post'],
              customOptions: {
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
      expect(schema.postInstance.autoValue).to.be.defined
      expect(schema.postInstance.label).to.equal('Posts Instance')
      expect(schema.postInstance.autoform.type).to.equal('select-checkbox')
      expect(schema.postInstance.autoform.omit).to.equal(true)

      // TEST: schema WITH OVERWRITE of "autoform.omit"
      const schema2 = Denormalize.generateSimpleSchema(
        {
          postId: {
            type: String,
            optional: true,
            denormalize: {
              relation: Denormalize.RELATION_MANY_TO_ONE,
              relatedCollection: new Object(),
              fieldsToPick: ['post'],
              customOptions: {
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
      expect(schema2.postInstance.autoValue).to.be.defined
      expect(schema2.postInstance.label).to.equal('Posts Instance')
      expect(schema2.postInstance.autoform.type).to.equal('select-checkbox')
      expect(schema2.postInstance.autoform.omit).to.equal('overwrite standard')
    })

    it('Example 1 (one to many) works with insert and assignment from comments ', function () {
      // Init
      CommentsSimple.remove({})
      PostsSimple.remove({})

      // Scenario
      // 1) insert a new post
      // 2) insert a new comment and assign it to post
      const postId = PostsSimple.insert({
        post: 'post 1',
      })
      const commentId = CommentsSimple.insert({
        comment: 'comment 1',
        postId: postId,
      })

      // Test: did it work?
      const post = PostsSimple.findOne(postId)
      const comment = CommentsSimple.findOne(commentId)
      expect(comment.postId).to.equal(postId)
      expect(comment.postInstance.post).to.equal('post 1')

      // TODO
      // expect(post.commentIds).to.deep.equal([commentId])
      // expect(post.commentInstances.length).to.equal(1)
      // expect(post.commentInstances[0].comment).to.equal('comment 1')
    })

    /*
    it('Example 1 (one to many) works with insert and assignment from posts', function () {
      // Init
      CommentsSimple.remove({})
      PostsSimple.remove({})

      // Scenario
      // 1) insert a new post
      // 2) insert a new comment and assign it to post
      const commentId = CommentsSimple.insert({
        comment: 'comment 1',
      })
      const postId = PostsSimple.insert({
        post: 'post 1',
        commentIds: [
          postId,
        ],
      })

      // Test: did it work?
      const post = PostsSimple.findOne(postId)
      const comment = CommentsSimple.findOne(commentId)
      expect(post.commentIds).to.deep.equal([commentId])
      expect(post.commentInstances.length).to.equal(1)
      expect(post.commentInstances[0].comment).to.equal('comment 1')
      expect(comment.postId).to.equal(postId)
      expect(comment.postInstance.post).to.equal('comment 1')
    })
  */
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
      fieldsToPick: ['post'],
      customOptions: {
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
