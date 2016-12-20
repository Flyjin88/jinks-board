if(Meteor.isServer) {

  JsonRoutes.add('get', '/api/boards/:boardId', function (req, res) {
    const boardId = req.params.boardId;
    let user = null;
    const loginToken = req.query.authToken;
    if (loginToken) {
      const hashToken = Accounts._hashLoginToken(loginToken);
      user = Meteor.users.findOne({
        'services.resume.loginTokens.hashedToken': hashToken,
      });
    }

    const exporter = new Exporter(boardId);
    if(exporter.canExport(user)) {
      JsonRoutes.sendResult(res, 200, exporter.build());
    } else {
      JsonRoutes.sendResult(res, 403);
    }
  });
}

class Exporter {
  constructor(boardId) {
    this._boardId = boardId;
  }

  build() {
    const byBoard = {boardId: this._boardId};
    const noBoardId = {fields: {boardId: 0}};
    const result = {
      _format: 'wekan-board-1.0.0',
    };
    _.extend(result, Boards.findOne(this._boardId, {fields: {stars: 0}}));
    result.lists = Lists.find(byBoard, noBoardId).fetch();
    result.cards = Cards.find(byBoard, noBoardId).fetch();
    result.comments = CardComments.find(byBoard, noBoardId).fetch();
    result.activities = Activities.find(byBoard, noBoardId).fetch();
    result.attachments = Attachments.find(byBoard).fetch().map((attachment) => {
      return {
        _id: attachment._id,
        cardId: attachment.cardId,
        url: FlowRouter.url(attachment.url()),
      };
    });

    const users = {};
    result.members.forEach((member) => {users[member.userId] = true;});
    result.lists.forEach((list) => {users[list.userId] = true;});
    result.cards.forEach((card) => {
      users[card.userId] = true;
      if (card.members) {
        card.members.forEach((memberId) => {users[memberId] = true;});
      }
    });
    result.comments.forEach((comment) => {users[comment.userId] = true;});
    result.activities.forEach((activity) => {users[activity.userId] = true;});
    const byUserIds = {_id: {$in: Object.getOwnPropertyNames(users)}};
    const userFields = {fields: {
      _id: 1,
      username: 1,
      'profile.fullname': 1,
      'profile.initials': 1,
      'profile.avatarUrl': 1,
    }};
    result.users = Users.find(byUserIds, userFields).fetch().map((user) => {
      if(user.profile.avatarUrl) {
        user.profile.avatarUrl = FlowRouter.url(user.profile.avatarUrl);
      }
      return user;
    });
    return result;
  }

  canExport(user) {
    const board = Boards.findOne(this._boardId);
    return board && board.isVisibleBy(user);
  }
}
