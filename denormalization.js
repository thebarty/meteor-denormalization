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
 * Attach helper to standard
 * @param  {[type]} schema  [description]
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
  let mergedSchema = {}
  for (const schema of schemas) {
    const denormalizedSchema = Denormalize.generateSimpleSchema(schema, AUTOFORM_IS_ACTIVE)
    denormalizedSchemas.push(denormalizedSchema)
    _.extend(mergedSchema, denormalizedSchema)
  }
  Denormalize.hookMeUp(this, mergedSchema)

  // attach "denormalized"-Schemas via standard SimpleSchema.attachSchema
  this.attachSchema(denormalizedSchemas)
}

// ===========================================================
// DENORMALIZE CLASS
// ===========================================================
export const Denormalize = class Denormalize {
  // ================================================
  // PUBLIC API (to be used from outside)

  /**
   * Build the denormalized schema, that contains a valid
   *  reference- and cache-property. Our main goal is to introduce
   *  the cache-propertyto SimpleSchema, which will then allow it to exist.
   *
   * This way we can still rely on SimpleSchema's validation logic,
   *  when updating the document.
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

  /**
   * Hook up the defined denormalization-strategy to the collection.
   *
   * We are using collection-hooks package here and simply call its functions.
   * It is possible to attach multiple hooks of the same type to a collection.
   *
   * @param  {[type]} collection [description]
   * @param  {[type]} schema     [description]
   * @return {[type]}            [description]
   */
  static hookMeUp(collection, schema) {
    // create insert- update- remove-hooks
    debug(`creating hooks for collection "${collection._name}"`)

    const denormalizedKeys = Denormalize._findDenormalizedKeysInSchema(schema)
    for (const key of denormalizedKeys) {
      debug(`creating hooks for key "${key}" `)
      Denormalize._validateDenormalizedSettings(schema, key)
      const { relation, relatedCollection, relatedReference, pickAttributes, omitAttributes, extendCacheFieldBy } = schema[key]['denormalize']
      const mode = Denormalize._getModeForKey(key)
      const cacheName = Denormalize._getCacheNameFromReferenceKey(key)

      if (relation===Denormalize.RELATION_MANY_TO_ONE) {
        // "RELATION_MANY_TO_ONE"
        //  example: MANY "comments" can belong to ONE post
        //  WE ARE IN THE "COMMENTS"-COLLECTION
        //  and want to reference to the one post we belong to.
        //  There are 2 properties for doing so:
        //   1) referenceProperty: comments.postId
        //   2) cacheProperty:     comments.postCache:

        // INSERT-HOOK (p.e. "a comment is inserted, maybe with a post attached")
        collection.after.insert(function (userId, doc) {
          debug('=====================================================')
          debug(`${collection._name}.after.insert - field ${key} (RELATION_MANY_TO_ONE to ${relatedCollection._name}.${relatedReference})`)
          const docId = this._id
          const referenceId = doc[key]
          if (referenceId) {
            // edit collection (p.e. comment):
            //  * fill the cacheProperty by loading from related collection
            //  (p.e. load "postCache" by "postId")
            Denormalize._updateCacheInCollection({
              collection,
              _id: docId,
              valueForOneCache: Denormalize._pickAndOmitFields(relatedCollection.findOne(referenceId), pickAttributes, omitAttributes),
              referenceProperty: key,
            })

            // edit relatedCollection (p.e. post):
            //  * add comment._id to postIds
            //  * add comment-instance to postCache
            let relatedDoc = relatedCollection.findOne(referenceId)
            relatedDoc = Denormalize._ensureArrayProperty(relatedDoc, relatedReference)
            const cacheName = Denormalize._getCacheNameFromReferenceKey(relatedReference)
            relatedDoc = Denormalize._ensureCacheInstancesProperty({ doc: relatedDoc, cacheName })
            relatedDoc[relatedReference].push(docId)
            relatedDoc[cacheName][Denormalize.CACHE_INSTANCE_FIELD].push(doc)
            Denormalize._updateDocInCollection({
              doc: relatedDoc,
              collection: relatedCollection,
            })
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
      } else if (relation===Denormalize.RELATION_ONE_TO_MANY) {
        // "RELATION_ONE_TO_MANY"
        //  example: ONE post can have MANY "comments"
        //  WE ARE IN THE "POSTS"-COLLECTION
        //  and want to reference to the many comments
        //  that belong to our single post.
        //  There are 2 properties for doing so:
        //   1) referenceProperty: posts.commentIds
        //   2) cacheProperty:     posts.commentCache[Denormalize.CACHE_INSTANCE_FIELD]:

        // INSERT-HOOK (p.e. "a post is inserted, maybe with comments attached")
        collection.after.insert(function (userId, doc) {
          debug('=====================================================')
          debug(`${collection._name}.after.insert - field ${key} (RELATION_ONE_TO_MANY to ${relatedCollection._name}.${relatedReference})`)

          const docId = this._id
          const referenceIds = doc[key]
          if (referenceIds) {
            // edit collection (p.e. posts):
            //  * fill the cacheProperty by loading from related collection
            //  (p.e. "commentCache[Denormalize.CACHE_INSTANCE_FIELD]" by "commentIds")
            //
            //  We are in INSERT MODE and do NOT need to compare what changed,
            //  so simply LOOP THRU id-FIELDS set in doc
            //  and collect instances for cache
            const newCache = []
            for (const referenceId of referenceIds) {
              const docInRelatedCollection = relatedCollection.findOne(referenceId)
              if (!docInRelatedCollection) {
                throw new Error(`data inconsistency detected - a doc with the given id "${referenceId}" does NOT exist in collection "${relatedCollection}._name"`)
              }
              newCache.push(docInRelatedCollection)
            }
            Denormalize._updateCacheInCollection({
              collection,
              _id: docId,
              valueForManyCache: newCache,
              referenceProperty: key,
            })

            // edit relatedCollection (p.e. comments - "a post was inserted, maybe with comments attached")
            // Loop comments (stored as referenceIds in Posts) and edit each like this:
            //  * add post._id to comment.postId
            //  * add post-instance to comment.postCache
            //  * if before the comment was assigned to a different Post,
            //    then remove the current comment from the old-referenced Post.
            const cacheNameRelated = Denormalize._getCacheNameFromReferenceKey(relatedReference)
            for (const referenceId of referenceIds) {
              let docRelated = relatedCollection.findOne(referenceId)
              const docIdReferencedBefore = docRelated[relatedReference]  // store for later
              // .. relatedReference
              docRelated[relatedReference] = docId
              // .. cacheNameRelated
              docRelated[cacheNameRelated] = doc
              Denormalize._updateDocInCollection({
                doc: docRelated,
                collection: relatedCollection,
              })

              // if before the comment (relatedDoc) was assigned to a different Post (collection),
              //  then remove the current comment (referenceId) from the old-referenced Post (collection).
              if (docIdReferencedBefore
                && docIdReferencedBefore!==referenceId) {
                const docReferencedBefore = collection.findOne(docIdReferencedBefore)
                const oldReferenceInDocReferencedBefore = docReferencedBefore[key]
                debug(`clearing old relation to "${docIdReferencedBefore}" from doc "${referenceId}" in collection ${collection._name}`, docReferencedBefore)
                // validating consitency
                if (!docReferencedBefore
                  || (docReferencedBefore && !docReferencedBefore[key])) {
                  throw new Error(`the doc previously referenced to "${collection._name}" with id "${docIdReferencedBefore}", but the referenced doc does NOT exist - there is something wrong here and we are at risk of data inconsistency!`)
                }
                // Renew the denormalization of a doc
                // by passing a new value for referenceIds
                Denormalize._setReferenceAndReloadCache({
                  _id: docIdReferencedBefore,
                  collection,
                  relatedCollection,
                  valueForReferenceMany: _.without(docReferencedBefore[key], referenceId),
                  relatedReference: key,
                })
              }
            }
          }
        })

        //  UPDATE-HOOK (p.e. "a post gets updated, maybe it got som comments
        //   added and some removed, maybe it gets a different text, ...")
        //  collection (p.e. posts):
        //  * collection: (p.e. "post")
        //    * where comments added or removed? yes: refill the cacheProperty
        //      by loading from related collection. If it was removed:
        //      set "comment.postId: null" && "comment.postCache: null"
        //      (p.e. fill "postCache" by new "postId")
        //  * relatedCollection (p.e. comment):
        //    * did comment.postId change? If yes, then update the old related posts-collection to have null at postsId. Update comment.postId and comment.postCache
        //    * Whenever a standard-property of "collection" has changed:
        //      reload the chached-version in relatedCollection.

        // REMOVE-HOOK
        //  * collection (p.e. posts):
        //  * relatedCollection (p.e. comments):
        //    * Set all related comments to ``comments.postId = null``
        //    * and ``comments.postCache = null``
      }
    }
  }

  // ================================================
  // PRIVATE HELPER (not to be used from outside)
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
    return _.uniq(returnKeys)
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

  /**
   * Update the cacheProperty for a single document in a collection
   *  with the doc passed as a parameter.
   *
   * Either "valueForOneCache", oder "valueForManyCache"-option needs to be set.
   *  * "valueForOneCache" will update the cache we use for "*ONE*"-references
   *  * "valueForManyCache" will update the cache we use for "*MANY*"-references
   *
   * @param  {Collection} options.collection
   * @param  {Object} options.doc The doc that should be put into the cache
   * @return {Integer} nr of documents updated
   */
  static _updateCacheInCollection(options = {}) {
    new SimpleSchema({
      _id: { type: String },
      collection: { type: Mongo.Collection },
      valueForOneCache: { type: Object, blackbox: true, optional: true },
      valueForManyCache: { type: [Object], blackbox: true, optional: true },
      referenceProperty: { type: String },
    }).validate(options)
    if (!options.valueForOneCache && !options.valueForManyCache)
      throw new Error('you need to either set option "valueForOneCache" or "valueForManyCache"')

    const { _id, collection, valueForOneCache, valueForManyCache, referenceProperty } = options
    const cacheName = Denormalize._getCacheNameFromReferenceKey(referenceProperty)

    // build modifier depending on our cache-type ("one" or "many")
    let jsonModifier
    if (valueForOneCache) {
      jsonModifier = `{"$set": {"${cacheName}": ${JSON.stringify(valueForOneCache)} } }`
    } else {
      // valueForManyCache
      jsonModifier = `{"$set": {"${cacheName}": { "${Denormalize.CACHE_INSTANCE_FIELD}": ${JSON.stringify(valueForManyCache)} } } }`
      debug('valueForManyCache jsonModifier', jsonModifier)
    }
    const modifier = JSON.parse(jsonModifier)

    // update
    const updates = collection.direct.update(_id, modifier)
    if (updates) {
      debug(`updated cache "${cacheName}" of doc ("${_id}") in collection "${collection._name}"`)
    } else {
      throw new Error(`tried to update cache of doc ("${_id}") in collection "${collection._name}", BUT something went wrong - NO documents were updated!`)
    }
    return updates
  }

  /**
   * Make sure that an object has a specific property
   *  of type array.
   *
   *  If it has NO property, create it.
   *  If it has an existing-property, which is NO array: throw an error!
   *
   * @param  {Object} doc
   * @param  {String} property
   * @return {Object}
   */
  static _ensureArrayProperty(doc, property) {
    check(doc, Object)
    check(property, String)

    const existingProperty = doc[property]
    // validate that we have an array
    if (existingProperty && !_.isArray(existingProperty)) {
      throw new Error(`expected property "${property}" to be an array, BUT it is NOT!`)
    } else if (!existingProperty) {
      // create empty array if NOT exists
      doc[property] = []
    }
    return doc
  }

  /**
   * Ensure that an object(document) has a cacheProperty
   *  of type "{ cacheProperty: { instances: [] } }",
   *  which is what we story a "*many*"-relationship.
   *
   * @param  {Object} options.doc Document
   * @param  {String} options.cacheName the name cacheProperty
   * @return {[type]}         [description]
   */
  static _ensureCacheInstancesProperty(options = {}) {
    new SimpleSchema({
      doc: { type: Object, blackbox: true },
      cacheName: { type: String },
    }).validate(options)
    const { doc, cacheName } = options

    const existingProperty = doc[cacheName]
    if (!existingProperty) {
      doc[cacheName] = JSON.parse(`{ "${Denormalize.CACHE_INSTANCE_FIELD}": [] }`)
    } else {
      if (!existingProperty[Denormalize.CACHE_INSTANCE_FIELD]) {
        throw new Error(`expected existing cache to have an "instances"-field, BUT it has NOT - something is wrong here!`)
      }
      if (existingProperty[Denormalize.CACHE_INSTANCE_FIELD]
        && !_.isArray(existingProperty[Denormalize.CACHE_INSTANCE_FIELD])) {
        throw new Error(`expected existing cache[Denormalize.CACHE_INSTANCE_FIELD] to be type array, BUT it is NOT - something is wrong here!`)
      }
    }
    return doc
  }

  /**
   * Stupid helper that updates an doc in a collection,
   * with feature of doing a DIRECT update, bypassing any collection.hooks
   * and explicitly bypassing SimpleSchema and Collection2-features.
   *
   * We do this in order to make our update "invisible",
   * p.e. we do NOT want an ``AutoValue`` to change the updatedAt, createdAt property.
   *
   * @param  {Mongo.Collection} options.collection
   * @param  {Document} options.doc
   */
  static _updateDocInCollection(options = {}) {
    new SimpleSchema({
      collection: { type: Mongo.Collection },
      doc: { type: Object, blackbox: true },
    }).validate(options)

    const { collection, doc } = options

    const updates = collection.direct.update(doc._id, { $set: doc }, {
      bypassCollection2: true,
      validate: false,
      filter: false,
      autoConvert: false,
      removeEmptyStrings:false,
      getAutoValues: false
    })
    if (updates) {
      debug(`updated doc ("${doc._id}") in collection "${collection._name}"`)
    } else {
      throw new Error(`tried to update doc with id ("${doc._id}") in collection "${collection._name}", BUT it does NOT exist! Something is wrong!`)
    }
  }

  /**
   * Renew the denormalization of a doc
   * by passing a new value for referenceIds
   * @type {[type]}
   */
  static _setReferenceAndReloadCache(options = {}) {
    check(options._id, String)
    check(options.collection, Mongo.Collection)
    check(options.relatedCollection, Mongo.Collection)
    check(options.relatedReference, String)
    check(options.valueForReferenceOne, Match.Maybe(String))
    check(options.valueForReferenceMany, Match.Maybe([String]))
    if (!options.valueForReferenceOne && !options.valueForReferenceMany)
      throw new Error('you need to either set option "valueForReferenceOne" or "valueForReferenceMany"')
    const { _id, collection, relatedCollection, relatedReference, valueForReferenceOne, valueForReferenceMany } = options

    // prepare new doc
    const cacheName = Denormalize._getCacheNameFromReferenceKey(relatedReference)
    let doc = collection.findOne(_id)
    if (valueForReferenceOne) {
      doc[relatedReference] = valueForReferenceOne
      const relatedDoc = relatedCollection.findOne(valueForReferenceOne)
      if (!relatedDoc) {
        // validate consistency
        throw new Error(`you are referencing to a doc with id "${_id}" in collection "${relatedCollection._name}", but the doc does NOT exist - there is something wrong here`)
      }
      doc[cacheName] = relatedDoc
    } else {
      // valueForReferenceMany
      doc = Denormalize._ensureArrayProperty(doc, relatedReference)
      doc = Denormalize._ensureCacheInstancesProperty({ doc, cacheName })
      doc[relatedReference] = valueForReferenceMany
      const newCache = []
      for (const id of valueForReferenceMany) {
        const relatedDoc = relatedCollection.findOne(id)
        if (!relatedDoc) {
          // validate consistency
          throw new Error(`you are referencing to a doc with id "${_id}" in collection "${relatedCollection._name}", but the doc does NOT exist - there is something wrong here`)
        }
        newCache.push(relatedDoc)
      }
      doc[cacheName][Denormalize.CACHE_INSTANCE_FIELD] = newCache
    }

    // update doc
    Denormalize._updateDocInCollection({
      doc,
      collection,
    })
  }
}
Denormalize.RELATION_ONE_TO_MANY  = 'RELATION_ONE_TO_MANY'
Denormalize.RELATION_MANY_TO_ONE  = 'RELATION_MANY_TO_ONE'
Denormalize.RELATION_MANY_TO_MANY = 'RELATION_MANY_TO_MANY'
Denormalize.MODE_FLAT             = 'MODE_FLAT'
Denormalize.MODE_EMBEDDED         = 'MODE_EMBEDDED'
Denormalize.CACHE_INSTANCE_FIELD  = 'instances'
Denormalize.Debug                 = false
