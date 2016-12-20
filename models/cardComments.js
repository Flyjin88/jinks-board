CardComments = new Mongo.Collection('card_comments');

CardComments.attachSchema(new SimpleSchema({
  boardId: {
    type: String,
  },
  cardId: {
    type: String,
  },
  text: {
    type: String,
  },

  createdAt: {
    type: Date,
    denyUpdate: false,
    autoValue() {
      if (this.isInsert) {
        return new Date();
      } else {
        this.unset();
      }
    },
  },

  userId: {
    type: String,
    autoValue() { 
      if (this.isInsert && !this.isSet) {
        return this.userId;
      }
    },
  },
}));

CardComments.allow({
  insert(userId, doc) {
    return allowIsBoardMember(userId, Boards.findOne(doc.boardId));
  },
  update(userId, doc) {
    return userId === doc.userId;
  },
  remove(userId, doc) {
    return userId === doc.userId;
  },
  fetch: ['userId', 'boardId'],
});

CardComments.helpers({
  user() {
    return Users.findOne(this.userId);
  },
});

CardComments.hookOptions.after.update = { fetchPrevious: false };

if (Meteor.isServer) {
  CardComments.after.insert((userId, doc) => {
    Activities.insert({
      userId,
      activityType: 'addComment',
      boardId: doc.boardId,
      cardId: doc.cardId,
      commentId: doc._id,
    });
  });

  CardComments.after.remove((userId, doc) => {
    const activity = Activities.findOne({ commentId: doc._id });
    if (activity) {
      Activities.remove(activity._id);
    }
  });
}
