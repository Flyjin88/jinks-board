Meteor.subscribe('unsaved-edits');


UnsavedEdits = {

  get({ fieldName, docId }, defaultTo = '') {
    const unsavedValue = this._getCollectionDocument(fieldName, docId);
    if (unsavedValue) {
      return unsavedValue.value;
    } else {
      return defaultTo;
    }
  },

  has({ fieldName, docId }) {
    return Boolean(this.get({fieldName, docId}));
  },

  set({ fieldName, docId }, value) {
    const currentDoc = this._getCollectionDocument(fieldName, docId);
    if (currentDoc) {
      UnsavedEditCollection.update(currentDoc._id, { $set: { value }});
    } else {
      UnsavedEditCollection.insert({
        fieldName,
        docId,
        value,
      });
    }
  },

  reset({ fieldName, docId }) {
    const currentDoc = this._getCollectionDocument(fieldName, docId);
    if (currentDoc) {
      UnsavedEditCollection.remove(currentDoc._id);
    }
  },

  _getCollectionDocument(fieldName, docId) {
    return UnsavedEditCollection.findOne({fieldName, docId});
  },
};

Blaze.registerHelper('getUnsavedValue', (fieldName, docId, defaultTo) => {

  if (!_.isString(defaultTo)) {
    defaultTo = '';
  }
  return UnsavedEdits.get({ fieldName, docId }, defaultTo);
});

Blaze.registerHelper('hasUnsavedValue', (fieldName, docId) => {
  return UnsavedEdits.has({ fieldName, docId });
});
