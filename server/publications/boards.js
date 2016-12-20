
Meteor.publish('boards', function() {

  if (!Match.test(this.userId, String))
    return [];

  const {starredBoards = []} = Users.findOne(this.userId).profile;
  check(starredBoards, [String]);

  return Boards.find({
    archived: false,
    $or: [
      {
        _id: { $in: starredBoards },
        permission: 'public',
      },
      { members: { $elemMatch: { userId: this.userId, isActive: true }}},
    ],
  }, {
    fields: {
      _id: 1,
      archived: 1,
      slug: 1,
      title: 1,
      description: 1,
      color: 1,
      members: 1,
      permission: 1,
    },
  });
});

Meteor.publish('archivedBoards', function() {
  if (!Match.test(this.userId, String))
    return [];

  return Boards.find({
    archived: true,
    members: {
      $elemMatch: {
        userId: this.userId,
        isAdmin: true,
      },
    },
  }, {
    fields: {
      _id: 1,
      archived: 1,
      slug: 1,
      title: 1,
    },
  });
});

Meteor.publishRelations('board', function(boardId) {
  check(boardId, String);

  this.cursor(Boards.find({
    _id: boardId,
    archived: false,
    $or: [
      { permission: 'public' },
      { members: { $elemMatch: { userId: this.userId, isActive: true }}},
    ],
  }, { limit: 1 }), function(boardId, board) {
    this.cursor(Lists.find({ boardId }));


    this.cursor(Cards.find({ boardId }), function(cardId) {
      this.cursor(CardComments.find({ cardId }));
      this.cursor(Attachments.find({ cardId }));
    });

    this.cursor(Users.find({
      _id: { $in: _.pluck(board.members, 'userId') },
    }, { fields: {
      'username': 1,
      'profile.fullname': 1,
      'profile.avatarUrl': 1,
    }}), function(userId) {
      this.cursor(presences.find({ userId }));
    });
  });

  return this.ready();
});
