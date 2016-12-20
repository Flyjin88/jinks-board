Attachments = new FS.Collection('attachments', {
  stores: [

    new FS.Store.GridFS('attachments'),
  ],
});

if (Meteor.isServer) {
  Attachments.allow({
    insert(userId, doc) {
      return allowIsBoardMember(userId, Boards.findOne(doc.boardId));
    },
    update(userId, doc) {
      return allowIsBoardMember(userId, Boards.findOne(doc.boardId));
    },
    remove(userId, doc) {
      return allowIsBoardMember(userId, Boards.findOne(doc.boardId));
    },

    download(userId, doc) {
      const query = {
        $or: [
          { 'members.userId': userId },
          { permission: 'public' },
        ],
      };
      return Boolean(Boards.findOne(doc.boardId, query));
    },

    fetch: ['boardId'],
  });
}

// XXX Enforce a schema for the Attachments CollectionFS

Attachments.files.before.insert((userId, doc) => {
  const file = new FS.File(doc);
  doc.userId = userId;

  if (!file.isImage()) {
    file.original.type = 'application/octet-stream';
  }
});

if (Meteor.isServer) {
  Attachments.files.after.insert((userId, doc) => {
    Activities.insert({
      userId,
      type: 'card',
      activityType: 'addAttachment',
      attachmentId: doc._id,
      boardId: doc.boardId,
      cardId: doc.cardId,
    });
  });

  Attachments.files.after.remove((userId, doc) => {
    Activities.remove({
      attachmentId: doc._id,
    });
  });
}
