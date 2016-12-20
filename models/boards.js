Boards = new Mongo.Collection('boards');

Boards.attachSchema(new SimpleSchema({
  title: {
    type: String,
  },
  slug: {
    type: String,
    autoValue() {
      if (this.isInsert && !this.isSet) {
        let slug = 'board';
        const title = this.field('title');
        if (title.isSet) {
          slug = getSlug(title.value) || slug;
        }
        return slug;
      }
    },
  },
  archived: {
    type: Boolean,
    autoValue() {
      if (this.isInsert && !this.isSet) {
        return false;
      }
    },
  },
  createdAt: {
    type: Date,
    autoValue() {
      if (this.isInsert) {
        return new Date();
      } else {
        this.unset();
      }
    },
  },

  modifiedAt: {
    type: Date,
    optional: true,
    autoValue() {
      if (this.isUpdate) {
        return new Date();
      } else {
        this.unset();
      }
    },
  },

  stars: {
    type: Number,
    autoValue() {
      if (this.isInsert) {
        return 0;
      }
    },
  },

  'labels': {
    type: [Object],
    autoValue() {
      if (this.isInsert && !this.isSet) {
        const colors = Boards.simpleSchema()._schema['labels.$.color'].allowedValues;
        const defaultLabelsColors = _.clone(colors).splice(0, 6);
        return defaultLabelsColors.map((color) => ({
          color,
          _id: Random.id(6),
          name: '',
        }));
      }
    },
  },
  'labels.$._id': {

    type: String,
  },
  'labels.$.name': {
    type: String,
    optional: true,
  },
  'labels.$.color': {
    type: String,
    allowedValues: [
      'green', 'yellow', 'orange', 'red', 'purple',
      'blue', 'sky', 'lime', 'pink', 'black',
    ],
  },

  'members': {
    type: [Object],
    autoValue() {
      if (this.isInsert && !this.isSet) {
        return [{
          userId: this.userId,
          isAdmin: true,
          isActive: true,
        }];
      }
    },
  },
  'members.$.userId': {
    type: String,
  },
  'members.$.isAdmin': {
    type: Boolean,
  },
  'members.$.isActive': {
    type: Boolean,
  },
  permission: {
    type: String,
    allowedValues: ['public', 'private'],
  },
  color: {
    type: String,
    allowedValues: [
      'belize',
      'nephritis',
      'pomegranate',
      'pumpkin',
      'wisteria',
      'midnight',
    ],
    autoValue() {
      if (this.isInsert && !this.isSet) {
        return Boards.simpleSchema()._schema.color.allowedValues[0];
      }
    },
  },
  description: {
    type: String,
    optional: true,
  },
}));


Boards.helpers({

  isVisibleBy(user) {
    if(this.isPublic()) {

      return true;
    } else {
      return user && this.isActiveMember(user._id);
    }
  },

  /**
   * Is the user one of the active members of the board?
   *
   * @param userId
   * @returns {boolean} the member that matches, or undefined/false
   */
  isActiveMember(userId) {
    if(userId) {
      return this.members.find((member) => (member.userId === userId && member.isActive));
    } else {
      return false;
    }
  },

  isPublic() {
    return this.permission === 'public';
  },

  lists() {
    return Lists.find({ boardId: this._id, archived: false }, { sort: { sort: 1 }});
  },

  activities() {
    return Activities.find({ boardId: this._id }, { sort: { createdAt: -1 }});
  },

  activeMembers() {
    return _.where(this.members, {isActive: true});
  },

  activeAdmins() {
    return _.where(this.members, {isActive: true, isAdmin: true});
  },

  memberUsers() {
    return Users.find({ _id: {$in: _.pluck(this.members, 'userId')} });
  },

  getLabel(name, color) {
    return _.findWhere(this.labels, { name, color });
  },

  labelIndex(labelId) {
    return _.pluck(this.labels, '_id').indexOf(labelId);
  },

  memberIndex(memberId) {
    return _.pluck(this.members, 'userId').indexOf(memberId);
  },

  hasMember(memberId) {
    return !!_.findWhere(this.members, {userId: memberId, isActive: true});
  },

  hasAdmin(memberId) {
    return !!_.findWhere(this.members, {userId: memberId, isActive: true, isAdmin: true});
  },

  absoluteUrl() {
    return FlowRouter.url('board', { id: this._id, slug: this.slug });
  },

  colorClass() {
    return `board-color-${this.color}`;
  },

  pushLabel(name, color) {
    const _id = Random.id(6);
    Boards.direct.update(this._id, { $push: {labels: { _id, name, color }}});
    return _id;
  },
});

Boards.mutations({
  archive() {
    return { $set: { archived: true }};
  },

  restore() {
    return { $set: { archived: false }};
  },

  rename(title) {
    return { $set: { title }};
  },

  setDesciption(description) {
    return { $set: {description} };
  },

  setColor(color) {
    return { $set: { color }};
  },

  setVisibility(visibility) {
    return { $set: { permission: visibility }};
  },

  addLabel(name, color) {
    if (!this.getLabel(name, color)) {
      const _id = Random.id(6);
      return { $push: {labels: { _id, name, color }}};
    }
    return {};
  },

  editLabel(labelId, name, color) {
    if (!this.getLabel(name, color)) {
      const labelIndex = this.labelIndex(labelId);
      return {
        $set: {
          [`labels.${labelIndex}.name`]: name,
          [`labels.${labelIndex}.color`]: color,
        },
      };
    }
    return {};
  },

  removeLabel(labelId) {
    return { $pull: { labels: { _id: labelId }}};
  },

  addMember(memberId) {
    const memberIndex = this.memberIndex(memberId);
    if (memberIndex >= 0) {
      return {
        $set: {
          [`members.${memberIndex}.isActive`]: true,
        },
      };
    }

    return {
      $push: {
        members: {
          userId: memberId,
          isAdmin: false,
          isActive: true,
        },
      },
    };
  },

  removeMember(memberId) {
    const memberIndex = this.memberIndex(memberId);

    const allowRemove = (!this.members[memberIndex].isAdmin) || (this.activeAdmins().length > 1);
    if (!allowRemove) {
      return {
        $set: {
          [`members.${memberIndex}.isActive`]: true,
        },
      };
    }

    return {
      $set: {
        [`members.${memberIndex}.isActive`]: false,
        [`members.${memberIndex}.isAdmin`]: false,
      },
    };
  },

  setMemberPermission(memberId, isAdmin) {
    const memberIndex = this.memberIndex(memberId);

    if (memberId === Meteor.userId()) {
      isAdmin = this.members[memberIndex].isAdmin;
    }

    return {
      $set: {
        [`members.${memberIndex}.isAdmin`]: isAdmin,
      },
    };
  },
});

if (Meteor.isServer) {
  Boards.allow({
    insert: Meteor.userId,
    update: allowIsBoardAdmin,
    remove: allowIsBoardAdmin,
    fetch: ['members'],
  });

  Boards.deny({
    update(userId, board, fieldNames) {
      return _.contains(fieldNames, 'stars');
    },
    fetch: [],
  });

  Boards.deny({
    update(userId, doc, fieldNames, modifier) {
      if (!_.contains(fieldNames, 'members'))
        return false;

      if (!_.isObject(modifier.$pull && modifier.$pull.members))
        return false;

      const nbAdmins = _.where(doc.members, {isActive: true, isAdmin: true}).length;
      if (nbAdmins > 1)
        return false;

      const removedMemberId = modifier.$pull.members.userId;
      return Boolean(_.findWhere(doc.members, {
        userId: removedMemberId,
        isAdmin: true,
      }));
    },
    fetch: ['members'],
  });

  Meteor.methods({
    quitBoard(boardId) {
      check(boardId, String);
      const board = Boards.findOne(boardId);
      if (board) {
        const userId = Meteor.userId();
        const index = board.memberIndex(userId);
        if (index>=0) {
          board.removeMember(userId);
          return true;
        } else throw new Meteor.Error('error-board-notAMember');
      } else throw new Meteor.Error('error-board-doesNotExist');
    },
  });
}

if (Meteor.isServer) {
  Meteor.startup(() => {
    Boards._collection._ensureIndex({
      _id: 1,
      'members.userId': 1,
    }, { unique: true });
  });

  Boards.after.insert((userId, doc) => {
    Activities.insert({
      userId,
      type: 'board',
      activityTypeId: doc._id,
      activityType: 'createBoard',
      boardId: doc._id,
    });
  });

  Boards.after.update((userId, doc, fieldNames, modifier) => {
    if (!_.contains(fieldNames, 'labels') ||
      !modifier.$pull ||
      !modifier.$pull.labels ||
      !modifier.$pull.labels._id) {
      return;
    }

    const removedLabelId = modifier.$pull.labels._id;
    Cards.update(
      { boardId: doc._id },
      {
        $pull: {
          labelIds: removedLabelId,
        },
      },
      { multi: true }
    );
  });

  const foreachRemovedMember = (doc, modifier, callback) => {
    Object.keys(modifier).forEach((set) => {
      if (modifier[set] !== false) {
        return;
      }

      const parts = set.split('.');
      if (parts.length === 3 && parts[0] === 'members' && parts[2] === 'isActive') {
        callback(doc.members[parts[1]].userId);
      }
    });
  };

  Boards.before.update((userId, doc, fieldNames, modifier) => {
    if (!_.contains(fieldNames, 'members')) {
      return;
    }

    if (modifier.$set) {
      const boardId = doc._id;
      foreachRemovedMember(doc, modifier.$set, (memberId) => {
        Cards.update(
          { boardId },
          {
            $pull: {
              members: memberId,
              watchers: memberId,
            },
          },
          { multi: true }
        );

        Lists.update(
          { boardId },
          {
            $pull: {
              watchers: memberId,
            },
          },
          { multi: true }
        );

        const board = Boards._transform(doc);
        board.setWatcher(memberId, false);

        // Remove board from users starred list
        if (!board.isPublic()) {
          Users.update(
            memberId,
            {
              $pull: {
                'profile.starredBoards': boardId,
              },
            }
          );
        }
      });
    }
  });

  // Add a new activity if we add or remove a member to the board
  Boards.after.update((userId, doc, fieldNames, modifier) => {
    if (!_.contains(fieldNames, 'members')) {
      return;
    }

    // Say hello to the new member
    if (modifier.$push && modifier.$push.members) {
      const memberId = modifier.$push.members.userId;
      Activities.insert({
        userId,
        memberId,
        type: 'member',
        activityType: 'addBoardMember',
        boardId: doc._id,
      });
    }

    // Say goodbye to the former member
    if (modifier.$set) {
      foreachRemovedMember(doc, modifier.$set, (memberId) => {
        Activities.insert({
          userId,
          memberId,
          type: 'member',
          activityType: 'removeBoardMember',
          boardId: doc._id,
        });
      });
    }
  });
}
