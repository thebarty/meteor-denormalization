/**
 * Denormalization
 */
import _ from 'underscore'
import s from 'underscore.string'
const validateOptions = require('validate-options') // NPM helper https://www.npmjs.com/package/validate-options
                                                    // note: import {} will NOT work here!

// ===========================================================
// INITIALISATION AND LITTLE HELPER
// ===========================================================

// Extend SimpleSchema
SimpleSchema.extendOptions({
  // extend schema by help text
  denormalize: Match.Optional(Object),
})

// Test if autoform is active
export let AUTOFORM_IS_ACTIVE  // needed for tests
try {
  // there is NO other way to find out if AutoForm is active
  //  so lets find it out
  new SimpleSchema({
    test: {
      type: String,
      autoform: {  // only allowed by AutoForm. Otherwise SimpleSchema will throw an error
        omit: true,
      },
    }
  })
  AUTOFORM_IS_ACTIVE = true
} catch (e) {
  AUTOFORM_IS_ACTIVE = false
}

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

// ===========================================================
// DENORMALIZE CLASS
// ===========================================================
export const Denormalize = class Denormalize {
  /**
   * This function takes a SimpleSchema-Definition, which might contain "denormalize"-settings
   *  and turns it into a denormalized SimpleSchema, that automatically loads instances
   *  of referenced docs from the related collection, mainly via the ``autoValue`` function.
   *
   * Use this function when attaching your schema to the collection,
   *  p.e. like ``CommentsSimple.attachSchema(Denormalize.simpleSchema({ ... }))``
   *  where "{ ... }" is your schema-definition including "denormalize"-settings.
   *
   * @param  {[type]} schema [description]
   * @return {[type]}        [description]
   */
  static simpleSchema(schema) {
    return new SimpleSchema(Denormalize.generateSimpleSchema(schema, AUTOFORM_IS_ACTIVE))
  }

  /**
   * For easier testing this is a seperat function
   *  and added "autoFormIsActive" parameter,
   *  so we can set it from outside.
   *
   * @return {Object} Schema-Definition as pure JS-Object
   */
  static generateSimpleSchema(schema, autoFormIsActive) {
    let returnSchema = schema
    // 1) read schema and find "denormalize"-settings
    for (const key of _.keys(schema)) {
      // does this property have a "denormalize"-setting?
      if (s.endsWith(key, 'Id') || s.endsWith(key, 'Ids')) {
        // what MODE are we in?
        let mode
        if (s.contains('$')) {
          mode = Denormalize.MODE_EMBEDDED
        } else {
          mode = Denormalize.MODE_FLAT
        }

        // are settings really available?
        const denormalize = schema[key]['denormalize']
        if (denormalize) {
          debug(`property ${key} has denormalize settings`)
          const { relation, relatedCollection, fieldsToPick, customOptions } = denormalize
          // are settings complete?
          if (!relation) {
            throw new Error(`Missing "relation"-setting for property "${key}"`)
          }
          if (relation===Denormalize.RELATION_MANY_TO_ONE) {
            // "RELATION_MANY_TO_ONE"
            // are settings complete?
            if (!relatedCollection) {
              throw new Error(`Missing "relatedCollection"-setting for property "${key}"`)
            }
            const instanceFieldName = `${s.strLeft(key, 'Id')}Instance`
            const instanceField = {}
            instanceField.type = Object
            instanceField.optional = schema[key]['optional'] || false
            instanceField.blackbox = true
            instanceField.autoValue = function() {
              return Denormalize.autoValueOneToOne({
                relation,
                relatedCollection,
                fieldsToPick,
                referenceField: key,
                autoValueContext: this,
              })
            }
            // hide from autoform (if installed)
            if (autoFormIsActive) {
              instanceField.autoform = {
                omit: true,
              }
            }
            // customOptions are simply attached to the root of the new field
            if (customOptions) {
              // we do NOT want to let customOptions overwrite
              //  nested properties, p.e. "autoform.omit" when the nested property itself
              //  (p.e. "omit") is NOT set in "customOptions. Still we want to give customOptions priority.
              extend(instanceField, customOptions)
            }
            // attach instancefield to schema
            returnSchema[instanceFieldName] = instanceField
          } else {
            throw new Error(`RELATION-TYPE NOT YET SUPPORTED`)
          }
        }
      }
    }
    debug('generated denormalized SimpleSchema', returnSchema)
    return returnSchema
  }

  /**
   * DENORMALISATION-Helper for ``SimpleSchema.autoValue()``
   *  to hook up 2 relatedCollection via a "ONE-TO-ONE" relationship,
   *  p.e. "1 project has 1 contact".
   *
   * In this case, in the project relatedCollection you would have 2 fields:
   *  1) ``Project.contactId`` - meant for WRITE-ACCESS
   *  2) ``Project.contactInstance`` - meant for READ-ACCESS.
   *      Put this function into the ``autoValue``-function of this field.
   *
   * Within 2) this function will then save an instance of an document by loading it from the related relatedCollection
   *  **whenever the value of the referenceField (contactId) changes**!!
   *
   * The sibilingField saves the DocID!
   * The instanceField (options.instance) saves the full instance of the doc!
   *
   * SECURITY - BEST WAY TO USE:
   * Use the ``fieldsToPick`` to explicitly pass an array of fields to save.
   *
   * NOTE:
   * This is **STRICTLY COUPLED** to be used together with **``CollectionHooksHelper.cascadeUpdateRelatedCollection``**.
   * You also need also setup CollectionHooks on the original Collection
   * in order to sync diffs in the original document to this instance.
   *
   * The COLLECTION HOOK will simply touch the docId of the sibilingField
   * and this function here (autoValue) will load the docInstance!
   *
   * EXAMPLE:
   *  fromContactInstance: {
   *    type: Object,
   *    blackbox: true, // skip validation for all included fiels
   *    optional: true,
   *    autoValue: function () {
   *      return Collection2Helper.returnAutoValueForSibilingFieldOneToOne({
   *        instance: this,
   *        referenceField: 'fromContactId',
   *        relatedCollection: Contacts.Collection,
   *        fieldsToPick: ['profileSecure'],
   *        fieldsToOmit: ['unsecure'],
   *      });
   *    },
   *    autoform: {
   *      omit: true,
   *    },
   *  },
   *
   * PARAMETERS:
   * .. mandatory
   * @param instance      Instance of ``autoform.autovalue.this`
   * @param referenceField  Name of the sibling field (as String)
   * @param relatedCollection    Instance of Collection
   *
   * .. optional:
   * @param fieldsToPick  Array of fields to pick before returning (BEST OPTION, SECURE!)
   * @param fieldsToOmit  Array of fields to omit before returning
   */
  static autoValueOneToOne (options) {
    validateOptions.hasAll(options, 'autoValueContext', 'referenceField', 'relatedCollection')
    // optional fieldsToOmit
    // optional fieldsToPick

    // log('returnAutoValueForSibilingFieldOneToOne for ' + options.referenceField);

    var sibilingIdField = options.autoValueContext.field(options.referenceField);

    // is the field set and does it have a value?
    if (sibilingIdField.isSet && sibilingIdField.value) {
      // set
      var autoValueContext = options.relatedCollection.findOne({'_id': sibilingIdField.value});

      // REMOVE "_id" - otherwise SimpleSchema will throw an "not an object" error!
      autoValueContext = _.omit(autoValueContext, ['_id']);

      if (options.fieldsToOmit) {
        // omit (= omit fields, POTENTIALLY UNSECURE)
        return _.omit(autoValueContext, options.fieldsToOmit);
      } else if (options.fieldsToPick) {
        // pick (= SECURELY pick the fields to save)
        //  .. always save '_id'
        return _.pick(autoValueContext, options.fieldsToPick)
      } else {
        // standard (= save ALL fields, POTENTIALLY UNSECURE)
        return autoValueContext;
      }
    } else if (sibilingIdField.isSet) {
      // ONLY unset, if sibiling field is set!
      // unset (remove from document)
      return { $unset: '' };
    }
  }

  /**
   * DENORMALISATION-Helper for ``SimpleSchema.autoValue()``
   *  to hook up 2 relatedCollection via a "ONE-TO-MANY", or "MANY-TO-MANY" relationship,
   *  p.e. "1 product has m categories".
   *
   * In this case, in the products relatedCollection you would have 2 fields:
   *  1) "Products.categoryIds" - meant for WRITE-ACCESS
   *  2) "Product.categoryInstances" - meant for READ-ACCESS.
   *      Put this function into the ``autoValue``-function of this field.
   *
   * Placed within 2), this function will then RELOAD instances into ``Product.categoryInstances``
   *  whenever ``Products.categoryIds`` change.
   *
   * We support 2 MODES:
   *  1) FLAT-mode, where ids and instances are attached right at the doc-root,
   *     p.e. "Products.categoryIds" & "Product.categoryInstances"
   *  2) EMBEDDED-ARRAY-mode, where ids are attached in an embedded array with additional data,
   *     p.e. "Projects.suppliers.contactId" (together with other additional data, like order)
   *      and "Projects.supplierInstances" (with instances of contact-fields)
   *     NOTE: the best way would be to denormalize into "Projects.suppliers.contactInstance",
   *      BUT we did not find a good way to do this yet!!!
   *
   * NOTE: this is strictly-coupled with our ``CollectionHooksHelper
   *   .afterInsertHookOneToMany
   *   .afterUpdateHookOneToMany
   *   .afterRemoveHookOneToMany``-helper. You need to implement those to make sure
   *   that ``autoValue`` is run in the Collection.
   *
   * BACKGROUND:
   *  simple schema does NOT support ``type=array``,
   *  so this is our workaround: we save an array within an object
   *  as ``categories.instances``
   *
   * @param  {Object} options.sourceFieldIds the "id"-field in the sourceCollection we are refering to on changes. Should be renamed to "sourceFieldId"
   * @param  {Object} options.sourceFieldInstance the "fieldName" of the "instance"-field in the source-relatedCollection
   */
  static returnAutoValueForFieldOneToMany(options = {}) {
    validateOptions.hasAll(options, 'context', 'sourceFieldIds', 'sourceFieldInstance', 'relatedCollection',)
    // optional fieldsToOmit
    // optional fieldsToPick
    const { context, sourceFieldIds, sourceFieldInstance, relatedCollection, fieldsToOmit, fieldsToPick } = options

    let isEmbeddedArrayMode = false
    let embeddedArrayFieldRoot
    let embeddedArrayFieldIdField
    if (s.contains(sourceFieldIds, '.$.')) {
      // embedded Array field, p.e. "suppliers.$.contactId"
      isEmbeddedArrayMode = true
      const parts = sourceFieldIds.split('.$.')  // = SimpleSchema field-convention
      embeddedArrayFieldRoot = parts[0]
      embeddedArrayFieldIdField = parts[1]
      if (!embeddedArrayFieldRoot || !embeddedArrayFieldIdField) {
        throw new Error('wrong use of returnAutoValueForFieldOneToMany: when passing the "sourceFieldIds"-parameter for embedded array, pass the FULL simple-schema fieldname, p.e. like "suppliers.$.contactId"')
      }
    }

    let fieldContext
    if (isEmbeddedArrayMode) {
      // "embedded-array"-mode, p.e. ".suppliers.contactId/comment/order/*"
      //  and instance-field ".supplierInstances"
      fieldContext = context.field(embeddedArrayFieldRoot)
    } else {
      // "flat"-mode, p.e. id field ".productIds" and instance-field ".productInstances"
      fieldContext = context.field(sourceFieldIds)
    }

    // is the field set and does it have a value?
    if (fieldContext.isSet && fieldContext.value) {
      const values = fieldContext.value
      if (values) {
        const returnValue = []
        for (const value of values) {
          // find value of "_id"-field depending on mode
          let idValue
          if (isEmbeddedArrayMode) {
            // embedded mode: we are in the embedded array-object p.e. "suppliers[].*"
            //  and need to grab the id-field, p.e. "suppliers[].contactid"
            idValue = value[embeddedArrayFieldIdField]
          } else {
            // flat mode
            idValue = value
          }
          let doc = relatedCollection.findOne({ _id: idValue })
          doc = _.omit(doc, sourceFieldInstance)  // prevent loop and remove reference
          // clean if wanted
          if (fieldsToOmit) {
            // omit (= omit fields, POTENTIALLY UNSECURE)
            doc = _.omit(doc, fieldsToOmit)
          }
          if (fieldsToPick) {
            // pick (= SECURELY pick the fields to save)
            doc = _.pick(doc, fieldsToPick)
          }
          returnValue.push(doc)
        }
        return { instances: returnValue }
      }
    } else if (fieldContext.isSet) {
      // ONLY unset, if sibiling field is set!
      // unset (remove from document)
      return { $unset: '' }
    }
  }
}
Denormalize.RELATION_ONE_TO_MANY  = 'RELATION_ONE_TO_MANY'
Denormalize.RELATION_MANY_TO_ONE  = 'RELATION_MANY_TO_ONE'
Denormalize.RELATION_MANY_TO_MANY = 'RELATION_MANY_TO_MANY'
Denormalize.MODE_FLAT             = 'MODE_FLAT'
Denormalize.MODE_EMBEDDED         = 'MODE_EMBEDDED'
Denormalize.Debug                 = false
