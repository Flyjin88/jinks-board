let previousPath;
FlowRouter.triggers.exit([({path}) => {
  previousPath = path;
}]);

FlowRouter.route('/', {
  name: 'home',
  triggersEnter: [AccountsTemplates.ensureSignedIn],
  action() {
    Session.set('currentBoard', null);
    Session.set('currentCard', null);

    Filter.reset();
    EscapeActions.executeAll();

    BlazeLayout.render('defaultLayout', {
      headerBar: 'boardListHeaderBar',
      content: 'boardList',
    });
  },
});

FlowRouter.route('/b/:id/:slug', {
  name: 'board',
  action(params) {
    const currentBoard = params.id;
    const previousBoard = Session.get('currentBoard');
    Session.set('currentBoard', currentBoard);
    Session.set('currentCard', null);

    if (previousBoard !== currentBoard) {
      EscapeActions.executeAll();
    } else {
      EscapeActions.executeUpTo('popup-close');
    }

    BlazeLayout.render('defaultLayout', {
      headerBar: 'boardHeaderBar',
      content: 'board',
    });
  },
});

FlowRouter.route('/b/:boardId/:slug/:cardId', {
  name: 'card',
  action(params) {
    EscapeActions.executeUpTo('inlinedForm');

    Session.set('currentBoard', params.boardId);
    Session.set('currentCard', params.cardId);

    BlazeLayout.render('defaultLayout', {
      headerBar: 'boardHeaderBar',
      content: 'board',
    });
  },
});

FlowRouter.route('/shortcuts', {
  name: 'shortcuts',
  action() {
    const shortcutsTemplate = 'keyboardShortcuts';

    EscapeActions.executeUpTo('popup-close');

    if (previousPath) {
      Modal.open(shortcutsTemplate, {
        header: 'shortcutsModalTitle',
        onCloseGoTo: previousPath,
      });
    } else {
      BlazeLayout.render('defaultLayout', {
        headerBar: 'shortcutsHeaderBar',
        content: shortcutsTemplate,
      });
    }
  },
});

FlowRouter.route('/import', {
  name: 'import',
  triggersEnter: [
    AccountsTemplates.ensureSignedIn,
    () => {
      Session.set('currentBoard', null);
      Session.set('currentCard', null);

      Filter.reset();
      EscapeActions.executeAll();
    },
  ],
  action() {
    BlazeLayout.render('defaultLayout', {
      headerBar: 'importHeaderBar',
      content: 'import',
    });
  },
});

FlowRouter.notFound = {
  action() {
    BlazeLayout.render('defaultLayout', { content: 'notFound' });
  },
};

const redirections = {
  '/boards': '/',
  '/boards/:id/:slug': '/b/:id/:slug',
  '/boards/:id/:slug/:cardId': '/b/:id/:slug/:cardId',
};

_.each(redirections, (newPath, oldPath) => {
  FlowRouter.route(oldPath, {
    triggersEnter: [(context, redirect) => {
      redirect(FlowRouter.path(newPath, context.params));
    }],
  });
});

const appTitle = 'Jinks Realty Board';

Meteor.isClient && Meteor.startup(() => {
  Tracker.autorun(() => {
    const currentBoard = Boards.findOne(Session.get('currentBoard'));
    const titleStack = [appTitle];
    if (currentBoard) {
      titleStack.push(currentBoard.title);
    }
    DocHead.setTitle(titleStack.reverse().join(' - '));
  });
});
