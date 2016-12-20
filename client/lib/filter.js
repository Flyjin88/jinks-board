function showFilterSidebar() {
  Sidebar.setView('filter');
}

// Use a "set" filter for a field that is a set of documents uniquely
// identified. For instance `{ labels: ['labelA', 'labelC', 'labelD'] }`.
class SetFilter {
  constructor() {
    this._dep = new Tracker.Dependency();
    this._selectedElements = [];
  }

  isSelected(val) {
    this._dep.depend();
    return this._selectedElements.indexOf(val) > -1;
  }

  add(val) {
    if (this._indexOfVal(val) === -1) {
      this._selectedElements.push(val);
      this._dep.changed();
      showFilterSidebar();
    }
  }

  remove(val) {
    const indexOfVal = this._indexOfVal(val);
    if (this._indexOfVal(val) !== -1) {
      this._selectedElements.splice(indexOfVal, 1);
      this._dep.changed();
    }
  }

  toggle(val) {
    if (this._indexOfVal(val) === -1) {
      this.add(val);
    } else {
      this.remove(val);
    }
  }

  reset() {
    this._selectedElements = [];
    this._dep.changed();
  }

  _indexOfVal(val) {
    return this._selectedElements.indexOf(val);
  }

  _isActive() {
    this._dep.depend();
    return this._selectedElements.length !== 0;
  }

  _getMongoSelector() {
    this._dep.depend();
    return { $in: this._selectedElements };
  }
}

Filter = {
  labelIds: new SetFilter(),
  members: new SetFilter(),

  _fields: ['labelIds', 'members'],
  _exceptions: [],
  _exceptionsDep: new Tracker.Dependency(),

  isActive() {
    return _.any(this._fields, (fieldName) => {
      return this[fieldName]._isActive();
    });
  },

  _getMongoSelector() {
    if (!this.isActive())
      return {};

    const filterSelector = {};
    this._fields.forEach((fieldName) => {
      const filter = this[fieldName];
      if (filter._isActive())
        filterSelector[fieldName] = filter._getMongoSelector();
    });

    const exceptionsSelector = {_id: {$in: this._exceptions}};
    this._exceptionsDep.depend();

    return {$or: [filterSelector, exceptionsSelector]};
  },

  mongoSelector(additionalSelector) {
    const filterSelector = this._getMongoSelector();
    if (_.isUndefined(additionalSelector))
      return filterSelector;
    else
      return {$and: [filterSelector, additionalSelector]};
  },

  reset() {
    this._fields.forEach((fieldName) => {
      const filter = this[fieldName];
      filter.reset();
    });
    this.resetExceptions();
  },

  addException(_id) {
    if (this.isActive()) {
      this._exceptions.push(_id);
      this._exceptionsDep.changed();
      Tracker.flush();
    }
  },

  resetExceptions() {
    this._exceptions = [];
    this._exceptionsDep.changed();
  },
};

Blaze.registerHelper('Filter', Filter);
