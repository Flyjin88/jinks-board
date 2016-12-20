const DateString = Match.Where(function (dateAsString) {
  check(dateAsString, String);
  return moment(dateAsString, moment.ISO_8601).isValid();
});

class TrelloCreator {
  constructor(data) {
    this._nowDate = new Date();
    this.createdAt = {
      board: null,
      cards: {},
      lists: {},
    };

    this.createdBy = {
      cards: {}, // only cards have a field for that
    };

    this.labels = {};
    this.lists = {};
    this.comments = {};
    this.members = data.membersMapping ? data.membersMapping : {};
    this.attachments = {};
  }

  /**
   *
   * @param {String} dateString a properly formatted Date
   */
  _now(dateString) {
    if(dateString) {
      return new Date(dateString);
    }
    if(!this._nowDate) {
      this._nowDate = new Date();
    }
    return this._nowDate;
  }

  /**
   * if trelloUserId is provided and we have a mapping,
   * return it.
   * Otherwise return current logged user.
   * @param trelloUserId
   * @private
     */
  _user(trelloUserId) {
    if(trelloUserId && this.members[trelloUserId]) {
      return this.members[trelloUserId];
    }
    return Meteor.userId();
  }

  checkActions(trelloActions) {
    check(trelloActions, [Match.ObjectIncluding({
      data: Object,
      date: DateString,
      type: String,
    })]);
  }

  checkBoard(trelloBoard) {
    check(trelloBoard, Match.ObjectIncluding({
      closed: Boolean,
      name: String,
      prefs: Match.ObjectIncluding({
        background: String,
        permissionLevel: Match.Where((value) => {
          return ['org', 'private', 'public'].indexOf(value)>= 0;
        }),
      }),
    }));
  }

  checkCards(trelloCards) {
    check(trelloCards, [Match.ObjectIncluding({
      closed: Boolean,
      dateLastActivity: DateString,
      desc: String,
      idLabels: [String],
      idMembers: [String],
      name: String,
      pos: Number,
    })]);
  }

  checkLabels(trelloLabels) {
    check(trelloLabels, [Match.ObjectIncluding({
      color: String,
      name: String,
    })]);
  }

  checkLists(trelloLists) {
    check(trelloLists, [Match.ObjectIncluding({
      closed: Boolean,
      name: String,
    })]);
  }

  createBoardAndLabels(trelloBoard) {
    const boardToCreate = {
      archived: trelloBoard.closed,
      color: this.getColor(trelloBoard.prefs.background),
      createdAt: this._now(this.createdAt.board),
      labels: [],
      members: [{
        userId: Meteor.userId(),
        isAdmin: true,
        isActive: true,
      }],
      permission: this.getPermission(trelloBoard.prefs.permissionLevel),
      slug: getSlug(trelloBoard.name) || 'board',
      stars: 0,
      title: trelloBoard.name,
    };
    // now add other members
    if(trelloBoard.memberships) {
      trelloBoard.memberships.forEach((trelloMembership) => {
        const trelloId = trelloMembership.idMember;
        // do we have a mapping?
        if(this.members[trelloId]) {
          const wekanId = this.members[trelloId];
          // do we already have it in our list?
          const wekanMember = boardToCreate.members.find((wekanMember) => wekanMember.userId === wekanId);
          if(wekanMember) {
            // we're already mapped, but maybe with lower rights
            if(!wekanMember.isAdmin) {
              wekanMember.isAdmin = this.getAdmin(trelloMembership.memberType);
            }
          } else {
            boardToCreate.members.push({
              userId: wekanId,
              isAdmin: this.getAdmin(trelloMembership.memberType),
              isActive: true,
            });
          }
        }
      });
    }
    trelloBoard.labels.forEach((label) => {
      const labelToCreate = {
        _id: Random.id(6),
        color: label.color,
        name: label.name,
      };
      this.labels[label.id] = labelToCreate._id;
      boardToCreate.labels.push(labelToCreate);
    });
    const boardId = Boards.direct.insert(boardToCreate);
    Boards.direct.update(boardId, {$set: {modifiedAt: this._now()}});
    // log activity
    Activities.direct.insert({
      activityType: 'importBoard',
      boardId,
      createdAt: this._now(),
      source: {
        id: trelloBoard.id,
        system: 'Trello',
        url: trelloBoard.url,
      },
      // We attribute the import to current user,
      // not the author from the original object.
      userId: this._user(),
    });
    return boardId;
  }

  /**
   * @param trelloCards
   * @param boardId
   * @returns {Array}
   */
  createCards(trelloCards, boardId) {
    const result = [];
    trelloCards.forEach((card) => {
      const cardToCreate = {
        archived: card.closed,
        boardId,
        // very old boards won't have a creation activity so no creation date
        createdAt: this._now(this.createdAt.cards[card.id]),
        dateLastActivity: this._now(),
        description: card.desc,
        listId: this.lists[card.idList],
        sort: card.pos,
        title: card.name,
        // we attribute the card to its creator if available
        userId: this._user(this.createdBy.cards[card.id]),
      };
      // add labels
      if (card.idLabels) {
        cardToCreate.labelIds = card.idLabels.map((trelloId) => {
          return this.labels[trelloId];
        });
      }
      // add members {
      if(card.idMembers) {
        const wekanMembers = [];
        card.idMembers.forEach((trelloId) => {
          if(this.members[trelloId]) {
            const wekanId = this.members[trelloId];
            if(!wekanMembers.find((wId) => wId === wekanId)){
              wekanMembers.push(wekanId);
            }
          }
          return true;
        });
        if(wekanMembers.length>0) {
          cardToCreate.members = wekanMembers;
        }
      }
      // insert card
      const cardId = Cards.direct.insert(cardToCreate);
      // log activity
      Activities.direct.insert({
        activityType: 'importCard',
        boardId,
        cardId,
        createdAt: this._now(),
        listId: cardToCreate.listId,
        source: {
          id: card.id,
          system: 'Trello',
          url: card.url,
        },
        userId: this._user(),
      });
      // add comments
      const comments = this.comments[card.id];
      if (comments) {
        comments.forEach((comment) => {
          const commentToCreate = {
            boardId,
            cardId,
            createdAt: this._now(comment.date),
            text: comment.data.text,
            // we attribute the comment to the original author, default to current user
            userId: this._user(comment.memberCreator.id),
          };
          // dateLastActivity will be set from activity insert, no need to
          // update it ourselves
          const commentId = CardComments.direct.insert(commentToCreate);
          Activities.direct.insert({
            activityType: 'addComment',
            boardId: commentToCreate.boardId,
            cardId: commentToCreate.cardId,
            commentId,
            createdAt: this._now(commentToCreate.createdAt),
            userId: commentToCreate.userId,
          });
        });
      }
      const attachments = this.attachments[card.id];
      const trelloCoverId = card.idAttachmentCover;
      if (attachments) {
        attachments.forEach((att) => {
          const file = new FS.File();
          if(Meteor.isServer) {
            file.attachData(att.url, function (error) {
              file.boardId = boardId;
              file.cardId = cardId;
              if (error) {
                throw(error);
              } else {
                const wekanAtt = Attachments.insert(file, () => {
                  // we do nothing
                });
                //
                if(trelloCoverId === att.id) {
                  Cards.direct.update(cardId, { $set: {coverId: wekanAtt._id}});
                }
              }
            });
          }
        });
      }
      result.push(cardId);
    });
    return result;
  }

  // Create labels if they do not exist and load this.labels.
  createLabels(trelloLabels, board) {
    trelloLabels.forEach((label) => {
      const color = label.color;
      const name = label.name;
      const existingLabel = board.getLabel(name, color);
      if (existingLabel) {
        this.labels[label.id] = existingLabel._id;
      } else {
        const idLabelCreated = board.pushLabel(name, color);
        this.labels[label.id] = idLabelCreated;
      }
    });
  }

  createLists(trelloLists, boardId) {
    trelloLists.forEach((list) => {
      const listToCreate = {
        archived: list.closed,
        boardId,
        createdAt: this._now(this.createdAt.lists[list.id]),
        title: list.name,
      };
      const listId = Lists.direct.insert(listToCreate);
      Lists.direct.update(listId, {$set: {'updatedAt': this._now()}});
      this.lists[list.id] = listId;
      // log activity
      Activities.direct.insert({
        activityType: 'importList',
        boardId,
        createdAt: this._now(),
        listId,
        source: {
          id: list.id,
          system: 'Trello',
        },
        userId: this._user(),
      });
    });
  }

  getAdmin(trelloMemberType) {
    return trelloMemberType === 'admin';
  }

  getColor(trelloColorCode) {
    // trello color name => wekan color
    const mapColors = {
      'blue': 'belize',
      'orange': 'pumpkin',
      'green': 'nephritis',
      'red': 'pomegranate',
      'purple': 'wisteria',
      'pink': 'pomegranate',
      'lime': 'nephritis',
      'sky': 'belize',
      'grey': 'midnight',
    };
    const wekanColor = mapColors[trelloColorCode];
    return wekanColor || Boards.simpleSchema()._schema.color.allowedValues[0];
  }

  getPermission(trelloPermissionCode) {
    if (trelloPermissionCode === 'public') {
      return 'public';
    }
    return 'private';
  }

  parseActions(trelloActions) {
    trelloActions.forEach((action) => {
      if (action.type === 'addAttachmentToCard') {

        const trelloAttachment = action.data.attachment;
        if(trelloAttachment.url) {
          const trelloCardId = action.data.card.id;
          if(!this.attachments[trelloCardId]) {
            this.attachments[trelloCardId] = [];
          }
          this.attachments[trelloCardId].push(trelloAttachment);
        }
      } else if (action.type === 'commentCard') {
        const id = action.data.card.id;
        if (this.comments[id]) {
          this.comments[id].push(action);
        } else {
          this.comments[id] = [action];
        }
      } else if (action.type === 'createBoard') {
        this.createdAt.board = action.date;
      } else if (action.type === 'createCard') {
        const cardId = action.data.card.id;
        this.createdAt.cards[cardId] = action.date;
        this.createdBy.cards[cardId] = action.idMemberCreator;
      } else if (action.type === 'createList') {
        const listId = action.data.list.id;
        this.createdAt.lists[listId] = action.date;
      }
    });
  }
}

Meteor.methods({
  importTrelloBoard(trelloBoard, data) {
    const trelloCreator = new TrelloCreator(data);

    // 1. check all parameters are ok from a syntax point of view
    try {
      check(data, {
        membersMapping: Match.Optional(Object),
      });
      trelloCreator.checkActions(trelloBoard.actions);
      trelloCreator.checkBoard(trelloBoard);
      trelloCreator.checkLabels(trelloBoard.labels);
      trelloCreator.checkLists(trelloBoard.lists);
      trelloCreator.checkCards(trelloBoard.cards);
    } catch (e) {
      throw new Meteor.Error('error-json-schema');
    }

    // 2. check parameters are ok from a business point of view (exist &
    // authorized) nothing to check, everyone can import boards in their account

    // 3. create all elements
    trelloCreator.parseActions(trelloBoard.actions);
    const boardId = trelloCreator.createBoardAndLabels(trelloBoard);
    trelloCreator.createLists(trelloBoard.lists, boardId);
    trelloCreator.createCards(trelloBoard.cards, boardId);
    // XXX add members
    return boardId;
  },
});
