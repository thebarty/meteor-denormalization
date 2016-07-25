const validateOptions = require('validate-options') // NPM helper https://www.npmjs.com/package/validate-options
                                                    // note: import {} will NOT work here!

export const CollectionHooks = class CollectionHooks {
  // ==================================================================
  // "ONE-TO-ONE"-HOOKS
  // ==================================================================
  /**
   * Hook for "after.INSERT"-hook for "ONE-TO-ONE"-relationships.
   *
   * When we insert a category with products assigned,
   *  then this function will trigger products.categoryIds
   *  in order to load the category-instance right in time.
   *
   *  IMPORTANT: within the hook itself, call this function
   *   AND RETURN it to the caller(!!!),
   *   p.e. like ``return afterInsertHookOneToMany(...)``
   *
   * @param  {Object} options.doc Document that get inserted
   * @param  {Object} options.targetCollection Reference-Collection that we want to stay in sync with
   * @param  {Object} options.targetFieldId Field within targetCollection that contains references to doc._id (in sourceCollection)
   * @param  {Object} options.targetFieldInstance Field within targetCollection that contains references to instances (in sourceCollection)
   */
  static afterInsertHookManyToOne(options = {}) {
    validateOptions.hasAll(options, 'doc', 'targetCollection', 'targetFieldId', 'targetFieldInstance')
    const { doc, targetCollection, targetFieldId, targetFieldInstance } = options

    CollectionHooks.cascadeUpdateRelatedCollection({
      doc,
      targetCollection,
      targetFieldId,
      targetFieldInstance,
    })

    return false  // stop following hooks and prevent callback-loop
  }

  /**
   * DENORMALISATION HELPER to update docId-fields in related collections.
   *
   * IMPORTANT: This is HIGH-PERFORMANT, but DOES NOT WORK with fields within EMBEDDED ARRAYS,
   *  p.e. like "categories.$.categoryId" && "categories.$.categoryInstance"
   *  For Embedded-Arrays use our (slow!!!) work-around-function
   *   ``cascadeUpdateRelatedCollectionForEmbeddedArrays``
   *
   * The aim of this function is to trigger the linked ``autoValue`` function of the linked "instance"-field,
   *  which needs to be implemented using the ``returnAutoValueForSibilingFieldOneToOne``-function to load the instance automatically.
   *  In order to achieve this we simply "touch" the docId-field via a mongo $set.
   *
   * So you ALWAYS have to also implement the docInstance.autoValue within the schema
   *  and use ``Collection2Helper.returnAutoValueForSibilingFieldOneToOne``, which will then
   *  load the full docInstance into the datarow, whenever the "sibiling's docId-field" changes.
   *
   * REACTIVITY:
   * By touching the docId-field (which is in the **ROOT** of the related document)
   *  we also make sure, that Meteor's reactive-problem with updating **embedded** arrays|objects is skipped.
   *  So we will always have reactive data (even in aldeed:tabular).
   *
   * @param  {Object}       doc                   Document instance
   * @param  {Collection}   targetCollection      Collection where we will update the id-field
   * @param  {String}       targetFieldId         Field-Name (string) of the id-field that we want to touch
   * @param  {Collection}   targetFieldInstance   Field-Name (string) of the instance-field.
   *                                               NOTE: we keep this just for reference and do NOT use it!
   *                                               The autoValue-helper in the target-Collection will update the instance for us!
   */
  static cascadeUpdateRelatedCollection(options) {
    debug(`cascadeUpdateRelatedCollection`)
    validateOptions.hasAll(options, 'doc', 'targetCollection', 'targetFieldId', 'targetFieldInstance')

    // debug('===================================================');
    // debug('cascadeUpdateRelatedCollection for ' + options.targetCollection._name + '.' + options.targetFieldId);

    // EARLY EXIT: Is user authorized?
    // .. mainly used for Meteor.users() which gave us troubles on fixture-creation
    if (!Partitioner.group()) {
      // debug('skipping - NOT LOGGED IN!');
      return;
    }
    // build SELECTOR, p.e. ``{'customerContactId': doc._id}``
    var theSelector = JSON.parse('{"' + options.targetFieldId + '": "' + options.doc._id + '"}');

    // build MODIFIER, p.e. ``{$set: { customerContactId: doc._id, customerContactInstance: doc }}``
    var theModifier = JSON.parse(
      StringHelper.parse('{"$set": {"%s": "%s"}}', options.targetFieldId, options.doc._id
      // NOTE: We are NOT setting the instance here! The autoValue-helper in the target-Collection
      //  will update the instance for us!
      //
      //  This is HIGH PERFORMANT as potentially only ``targetFieldInstance.autoValue``
      //   will be run and NOT all autoValue-functions.
    ));

    if (options.targetCollection.find(theSelector).count() > 0) {
      nrOfUpdates = options.targetCollection.update(
        theSelector,
        theModifier,
        {multi: true}
      );
      debug(nrOfUpdates + ' docs were updated');
    }
  }
}
