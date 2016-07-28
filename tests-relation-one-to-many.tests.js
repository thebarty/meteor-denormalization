/* eslint-env mocha */
/* eslint-disable func-names, prefer-arrow-callback */

import { chai } from 'meteor/practicalmeteor:chai'
const expect = chai.expect

// Import and rename a variable exported by denormalization.js.
import { Denormalize, AUTOFORM_IS_ACTIVE } from 'meteor/thebarty:denormalization'
Denormalize.Debug = true

const OneToMany = new Mongo.Collection('onetomany')
const ManyToOne = new Mongo.Collection('manytoone')

// TESTS
if (Meteor.isServer) {
  describe('One-To-Many Relations work', function () {

    // CONFIGURATION
    // INSERT
    // UPDATE
    // REMOVE
    it('configuration works and throws errors where wanted', function () {
      // VALID config
      expect(() => {
        OneToMany.attachDenormalizedSchema(
          {
            manyIds: {
              type: [String],  // CORRECT
              denormalize: {
                relation: Denormalize.HAS_MANY,
                relatedCollection: ManyToOne,
                relatedReferenceProperty: 'oneId',
              },
            },
          },
        )
      }).to.not.throw()

      // INVALID configs
      expect(() => {
        OneToMany.attachDenormalizedSchema(
          {
            manyIds: {
              type: String,  // WRONG TYPE should throw
              denormalize: {
                relation: Denormalize.HAS_MANY,
                relatedCollection: ManyToOne,
                relatedReferenceProperty: 'oneId',
              },
            },
          },
        )
      }).to.throw()

      expect(() => {
        OneToMany.attachDenormalizedSchema(
          {
            manyIds: {
              type: String,
              denormalize: {
                // relation: Denormalize.HAS_MANY,
                relatedCollection: ManyToOne,
                relatedReferenceProperty: 'oneId',
              },
            },
          },
        )
      }).to.throw()

      expect(() => {
        OneToMany.attachDenormalizedSchema(
          {
            manyIds: {
              type: String,
              denormalize: {
                relation: Denormalize.HAS_MANY,
                // relatedCollection: ManyToOne,
                relatedReferenceProperty: 'oneId',
              },
            },
          },
        )
      }).to.throw()

      expect(() => {
        OneToMany.attachDenormalizedSchema(
          {
            manyIds: {
              type: String,
              denormalize: {
                relation: Denormalize.HAS_MANY,
                relatedCollection: ManyToOne,
                // relatedReferenceProperty: 'oneId',
              },
            },
          },
        )
      }).to.throw()
    })

    it('relation can be defined one-way', function () {
      OneToMany.remove({})
      ManyToOne.remove({})

      // Check that it works if only ONE collection has ``denormalize``-configs
      OneToMany.attachDenormalizedSchema(
        {
          string: {
            type: String,
          },
          manyIds: {
            type: [String],
            optional: false,  // MANDATORY
            denormalize: {
              relation: Denormalize.HAS_MANY,
              relatedCollection: ManyToOne,
              relatedReferenceProperty: 'oneId',
            },
          },
        },
      )
      ManyToOne.attachDenormalizedSchema(
        {
          string: {
            type: String,
          },
          // NO ``denormalize``-setting
        },
      )
      // insert works
      const manyToOneId1 = ManyToOne.insert({
        string: 'many to one 1',
      })
      expect(() => {
        const oneToManyId1 = OneToMany.insert({
          string: 'one to many 1'
        })
      }).to.throw()
      const oneToManyId1 = OneToMany.insert({
        string: 'one to many 1',
        manyIds: [
          manyToOneId1,
        ]
      })
      const oneToMany1 = OneToMany.findOne(oneToManyId1)
      // expect(oneToMany1.manyCache.instances.length).to.equal(1)
      // expect(oneToMany1.manyCache.instances[0]._id).to.equal(manyToOneId1)
      // expect(oneToMany1.manyCache.instances[0].string).to.equal('many to one 1')
      // expect update to work (even when relatedCollection ManyToOne does NOT have a denormalize-setting)
      // TODOD: MAKE THIS WORK
      ManyToOne.update(manyToOneId1, {$set: { string: 'many to one 1 NEW' } })
      const oneToMany2 = OneToMany.findOne(oneToManyId1)
      expect(oneToMany1.manyCache.instances.length).to.equal(1)
      expect(oneToMany1.manyCache.instances[0]._id).to.equal(manyToOneId1)
      expect(oneToMany1.manyCache.instances[0].string).to.equal('many to one 1 NEW')
    })
  })
}
