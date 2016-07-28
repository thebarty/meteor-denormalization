Guest.attachDenormalizedSchema({
  name: { type: String },
})

Comments.attachDenormalizedSchema({
  comment: { type: String },

  // 1 comment has 1 post
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

  // guest
  guestId: {
    type: String,
    optional: false,
    denormalize: {
      relation: Denormalize.HAS_ONE,
      relatedCollection: Guest,
      pickProperties: ['name'],
    },
  },
})

Posts.attachDenormalizedSchema({
  post: { type: String },

  // 1 comment has 1 post
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

/**
 * Scenario:
 *
 * Guest writes a comment for a post.
 *  - the comment stores the guest (and within the guestCache his name)
 *  - the post stores the comment (and within the commentCache.guestCache his name)
 *  - what if now guest updates his name: Will Post be updated?
 *
 */
