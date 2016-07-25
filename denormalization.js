/**
 * Denormalization
 */
import _ from 'underscore'
import s from 'underscore.string'
import { CollectionHooks } from 'meteor/thebarty:denormalization'

// ===========================================================
// INITIALISATION AND LITTLE HELPER
// ===========================================================

// Extend SimpleSchema
SimpleSchema.extendOptions({
  // extend schema by help text
  denormalize: Match.Optional(Object),
})

// Test if autoform is active
export const AUTOFORM_IS_ACTIVE = Package['aldeed:autoform']

/**
 * [debug description]
 */
const debug = function debug(message, object = undefined) {
  if (Denormalize.Debug) {
    console.log(message)
    if (object) {
      console.log(object)
    }
  }
}

/**
 * Extend Object by another object WITHOUT overwriting properties.
 * Thanks to http://stackoverflow.com/questions/20590177/merge-two-objects-without-override
 */
function extend (target) {
  for(var i=1; i<arguments.length; ++i) {
    var from = arguments[i];
    if(typeof from !== 'object') continue;
    for(var j in from) {
      if(from.hasOwnProperty(j)) {
        target[j] = typeof from[j]==='object'
        ? extend({}, target[j], from[j])
        : from[j];
      }
    }
  }
  return target;
}

/**
 * Attach helper
 * @param  {[type]} ss      [description]
 * @param  {[type]} options [description]
 * @return {[type]}         [description]
 */
Mongo.Collection.prototype.attachDenormalizedSchema = function attachDenormalizedSchema(schemas, options = {}) {
  // make sure that we always have an array
  if (!_.isArray(schemas)) {
    schemas = [schemas]
  }

  // loop thru array of schemas
  //  build cache field
  //  attach collection hooks
  let denormalizedSchemas = []
  for (const schema of schemas) {
    const denormalizedSchema = Denormalize.generateSimpleSchema(schema, AUTOFORM_IS_ACTIVE)
    denormalizedSchemas.push(denormalizedSchema)
    Denormalize.hookMeUp(this, schema)
  }
  // attach "denormalized"-Schemas via standard SimpleSchema.attachSchema
  this.attachSchema(denormalizedSchemas)
}

// ===========================================================
// DENORMALIZE CLASS
// ===========================================================
export const Denormalize = class Denormalize {
  static _findDenormalizedKeysInSchema(schema) {
    const returnKeys = []
    // find properties with "denormalize"-settings
    for (const key of _.keys(schema)) {
      // is the property called according our conventions?
      if (s.endsWith(key, 'Id') || s.endsWith(key, 'Ids')) {
        // does this property have a "denormalize"-setting?
        if (schema[key]['denormalize']) {
          returnKeys.push(key)
        }
      }
    }
    return returnKeys
  }

  static _getModeForKey(key) {
    if (s.contains(key, '$')) {
      return Denormalize.MODE_EMBEDDED
    } else {
      return Denormalize.MODE_FLAT
    }
  }

  static _getCacheNameFromReferenceKey(key) {
    return `${s.strLeft(key, 'Id')}Cache`
  }

  static _validateDenormalizedSettings(schema, key) {
    const settings = schema[key]['denormalize'] || {}
    // base-validation
    new SimpleSchema({
      relation: { type: String, allowedValues: [
        Denormalize.RELATION_MANY_TO_ONE,
        Denormalize.RELATION_ONE_TO_MANY,
        // other relations NOT YET supported
      ] },
      relatedCollection: { type: Mongo.Collection },
      relatedReference: { type: String, optional: true },
      pickAttributes: { type: [String], optional: true },
      omitAttributes: { type: [String], optional: true },
      extendCacheFieldBy: { type: Object, optional: true, blackbox: true, }
    }).validate(settings)
    debug('settings', settings)

    // more detailed validation
    if (settings.relation===Denormalize.RELATION_MANY_TO_ONE) {
      // "relatedReference" is mandatory
      if (!Match.test(settings.relatedReference, String)) {
        throw new Error(`you need to define "relatedReference" when using a "RELATION_MANY_TO_ONE"-relation for property "${key}"`)
      }
      // "relatedReference"-field needs to exist in schema of relatedCollection
      //  simpleSchema is NOT available during instanciation of the collections
      if (settings.relatedCollection.simpleSchema()
          && !_.contains(settings.relatedCollection.simpleSchema()._schemaKeys, settings.relatedReference)) {
        throw new Error(`within key "${key}" you are referencing relatedReference to "${settings.relatedCollection._name}.${settings.relatedReference}", BUT this property does NOT exist in collection "${settings.relatedCollection._name}"`)
      }

    }
  }

  static hookMeUp(collection, schema) {
    // create insert- update- remove-hooks
    debug(`hookMeUp for collection "${collection._name}"`)

    const denormalizedKeys = Denormalize._findDenormalizedKeysInSchema(schema)
    for (const key of denormalizedKeys) {
      debug(`processing denormalized key "${key}" `)
      Denormalize._validateDenormalizedSettings(schema, key)
      const { relation, relatedCollection, relatedReference, pickAttributes, omitAttributes, extendCacheFieldBy } = schema[key]['denormalize']
      const mode = Denormalize._getModeForKey(key)
      const cacheName = Denormalize._getCacheNameFromReferenceKey(key)

      if (relation===Denormalize.RELATION_MANY_TO_ONE) {
        // "RELATION_MANY_TO_ONE"
        //  example: MANY "comments" can belong to ONE post
        //  WE ARE IN THE "COMMENTS"-COLLECTION
        //   1) referenceProperty: comments.postId
        //   2) cacheProperty:     comments.postCache:

        // INSERT-HOOK (p.e. "a comment is inserted")
        collection.after.insert(function (userId, doc) {
          debug('=====================================================')
          debug(`${collection._name}.after.insert - field ${key}`)
          const docId = this._id
          const referenceId = doc[key]
          if (referenceId) {
            // collection (p.e. comment):
            //  * fill the cacheProperty by loading from related collection
            //  (p.e. "postCache" by "postId")
            const docForCache = Denormalize._pickAndOmitFields(relatedCollection.findOne(referenceId), pickAttributes, omitAttributes)
            const jsonModifier = `{"$set": {"${cacheName}": ${JSON.stringify(docForCache)} } }`
            const modifier = JSON.parse(jsonModifier)
            const updates = collection.direct.update(doc._id, modifier)
            debug(`${updates} docs updated in collection ${collection._name}`)

            // relatedCollection (p.e. post):
            //  * add comment._id to postIds
            //  * add comment-instance to postCache
            const cacheNameInRelatedCollection = Denormalize._getCacheNameFromReferenceKey(relatedReference)
            const jsonSelector = `{ "_id": "${referenceId}" }`
            const selector = JSON.parse(jsonSelector)
            const docInRelatedCollection = relatedCollection.findOne(selector)
            // .. relatedReference
            docInRelatedCollection[relatedReference] = docInRelatedCollection[relatedReference] || []
            docInRelatedCollection[relatedReference].push(docId)
            // .. cacheNameInRelatedCollection
            if (!docInRelatedCollection[cacheNameInRelatedCollection]
              || (docInRelatedCollection[cacheNameInRelatedCollection]
                && !ocInRelatedCollection[cacheNameInRelatedCollection].instances)) {
              docInRelatedCollection[cacheNameInRelatedCollection] = { instances: [] }
            }
            docInRelatedCollection[cacheNameInRelatedCollection].instances.push(doc)
            const updates2 = relatedCollection.direct.update(docInRelatedCollection._id, { $set: docInRelatedCollection }, {bypassCollection2: true, validate: false, filter: false, autoConvert: false, removeEmptyStrings:false, getAutoValues: false })
            debug(`${updates2} docs updated in collection ${relatedCollection._name}`)
          }
        })

        // UPDATE-HOOK (p.e. "a comment is updated")
        //  * collection: (p.e. "comment")
        //    * did postId change or was it removed? If yes: refill the
        //      cacheProperty by loading from related collection. If it was removed:
        //      set "postId: null" && "postCache: null"
        //      (p.e. fill "postCache" by new "postId")
        //  * relatedCollection (p.e. post):
        //    * did collection.postId change or was it removed? If yes: in the old referenceId: Remove commentId from commentIds (including commentCache) and in NEW referneceID: add commentId and commentCache.
        //    * Whenever a standard-property of "collection" has changed:
        //      reload the chached-version in relatedCollection.
        //    * If "collection._id" was remove, remove it from "relatedCollection"
        //
        // REMOVE-HOOK
        //  * collection (p.e. comment):
        //  * relatedCollection (p.e. post):
        //    * remove _id from comment._id to postIds
        //    * remove _id forom postCache
      }
    }
  }

  /**
   * Build the denormalized schema, that contains valid
   *  reference- and cache-property. Our main introduce the cache-property
   *  to SimpleSchema and allow it to exist.
   *
   * Background info: For easier testing this is a separate function
   *  and added "autoFormIsActive" parameter, so we can set it from outside.
   *
   * @return {Object} Schema-Definition as pure JS-Object
   */
  static generateSimpleSchema(schema, autoFormIsActive) {
    let returnSchema = schema

    // Loop thru schema, validate "denormalized" and extend the schema with
    //  an valid reference and cache field
    const denormalizedKeys = Denormalize._findDenormalizedKeysInSchema(schema)
    for (const key of denormalizedKeys) {
      debug(`processing denormalized key "${key}" `)

      const mode = Denormalize._getModeForKey(key)
      Denormalize._validateDenormalizedSettings(schema, key)
      const { relation, relatedCollection, pickAttributes, extendCacheFieldBy } = schema[key]['denormalize']

      const cacheName = Denormalize._getCacheNameFromReferenceKey(key)

      // add settings to reference-property
      if (relation===Denormalize.RELATION_MANY_TO_ONE) {
        schema[key]['type'] = String
      } else if (relation===Denormalize.RELATION_ONE_TO_MANY) {
        schema[key]['type'] = [String]
      }

      // Build the CACHE-PROPERTY
      const cacheProperty = {}
      // settings that CAN be overwritten by "extendCacheFieldBy"
      // hide from autoform (if installed)
      if (autoFormIsActive) {
        cacheProperty.autoform = {
          omit: true,
        }
      }
      // extendCacheFieldBy are simply attached to the root of the new field
      if (extendCacheFieldBy) {
        // we do NOT want to let extendCacheFieldBy overwrite
        //  nested properties, p.e. "autoform.omit" when the nested property itself
        //  (p.e. "omit") is NOT set in "extendCacheFieldBy. Still we want to give extendCacheFieldBy priority.
        extend(cacheProperty, extendCacheFieldBy)
      }
      // settings that CAN NOT be overwritten by "extendCacheFieldBy"
      cacheProperty.type = Object
      cacheProperty.optional = true
      cacheProperty.blackbox = true
      // attach instancefield to schema
      returnSchema[cacheName] = cacheProperty
      debug(`denormalized data for id-field "${key}" will be available in "${relatedCollection._name}.${cacheName}" `)
    }
    debug('generated denormalized SimpleSchema:', returnSchema)
    return returnSchema
  }

  static _pickAndOmitFields(doc, pickAttributes, omitAttributes) {
    check(doc, Object)
    check(pickAttributes, Match.Maybe([String]))
    check(omitAttributes, Match.Maybe([String]))
    let returnDoc = doc
    if (pickAttributes) {
      returnDoc = _.pick(returnDoc, pickAttributes)
    }
    if (omitAttributes) {
      returnDoc = _.omit(returnDoc, omitAttributes)
    }
    return returnDoc
  }
}
Denormalize.RELATION_ONE_TO_MANY  = 'RELATION_ONE_TO_MANY'
Denormalize.RELATION_MANY_TO_ONE  = 'RELATION_MANY_TO_ONE'
Denormalize.RELATION_MANY_TO_MANY = 'RELATION_MANY_TO_MANY'
Denormalize.MODE_FLAT             = 'MODE_FLAT'
Denormalize.MODE_EMBEDDED         = 'MODE_EMBEDDED'
Denormalize.Debug                 = false
