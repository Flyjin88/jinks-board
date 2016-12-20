
const isSandstorm = Meteor.settings && Meteor.settings.public &&
                    Meteor.settings.public.sandstorm;

const sandstormBoard = {
  _id: 'sandstorm',

  title: 'jinks-board',
  slug: 'libreboard',
  members: [],

  permission: 'public',
};

if (isSandstorm && Meteor.isServer) {
  function updateUserPermissions(userId, permissions) {
    const isActive = permissions.indexOf('participate') > -1;
    const isAdmin = permissions.indexOf('configure') > -1;
    const permissionDoc = { userId, isActive, isAdmin };

    const boardMembers = Boards.findOne(sandstormBoard._id).members;
    const memberIndex = _.pluck(boardMembers, 'userId').indexOf(userId);

    let modifier;
    if (memberIndex > -1)
      modifier = { $set: { [`members.${memberIndex}`]: permissionDoc }};
    else if (!isActive)
      modifier = {};
    else
      modifier = { $push: { members: permissionDoc }};

    Boards.update(sandstormBoard._id, modifier);
  }

  Picker.route('/', (params, req, res) => {
    const base = req.headers['x-sandstorm-base-path'];
    const { _id, slug } = sandstormBoard;
    const boardPath = FlowRouter.path('board', { id: _id, slug });

    res.writeHead(301, {
      Location: base + boardPath,
    });
    res.end();

    const user = Users.findOne({
      'services.sandstorm.id': req.headers['x-sandstorm-user-id'],
    });
    if (user) {

      Users.update(user._id, {
        $set: {
          'profile.fullname': user.services.sandstorm.name,
          'profile.avatarUrl': user.services.sandstorm.picture,
        },
      });
      updateUserPermissions(user._id, user.services.sandstorm.permissions);
    }
  });

  Users.after.insert((userId, doc) => {
    if (!Boards.findOne(sandstormBoard._id)) {
      Boards.insert(sandstormBoard, { validate: false });
      Activities.update(
        { activityTypeId: sandstormBoard._id },
        { $set: { userId: doc._id }}
      );
    }

    function generateUniqueUsername(username, appendNumber) {
      return username + String(appendNumber === 0 ? '' : appendNumber);
    }

    const username = doc.services.sandstorm.preferredHandle;
    let appendNumber = 0;
    while (Users.findOne({
      _id: { $ne: doc._id },
      username: generateUniqueUsername(username, appendNumber),
    })) {
      appendNumber += 1;
    }

    Users.update(doc._id, {
      $set: {
        username: generateUniqueUsername(username, appendNumber),
        'profile.fullname': doc.services.sandstorm.name,
        'profile.avatarUrl': doc.services.sandstorm.picture,
      },
    });

    updateUserPermissions(doc._id, doc.services.sandstorm.permissions);
  });

  Migrations.add('enforce-public-visibility-for-sandstorm', () => {
    Boards.update('sandstorm', { $set: { permission: 'public' }});
  });
}

if (isSandstorm && Meteor.isClient) {

  function updateSandstormMetaData(msg) {
    return window.parent.postMessage(msg, '*');
  }

  FlowRouter.triggers.enter([({ path }) => {
    updateSandstormMetaData({ setPath: path });
  }]);

  Tracker.autorun(() => {
    updateSandstormMetaData({ setTitle: DocHead.getTitle() });
  });

  FlowRouter._routesMap.home._triggersEnter.push((context, redirect) => {
    redirect(FlowRouter.path('board', {
      id: sandstormBoard._id,
      slug: sandstormBoard.slug,
    }));
  });

  const _absoluteUrl = Meteor.absoluteUrl;
  const _defaultOptions = Meteor.absoluteUrl.defaultOptions;
  Meteor.absoluteUrl = (path, options) => {
    const url = _absoluteUrl(path, options);
    return url.replace(/^https?:\/\/127\.0\.0\.1:[0-9]{2,5}/, '');
  };
  Meteor.absoluteUrl.defaultOptions = _defaultOptions;
}

Blaze.registerHelper('isSandstorm', isSandstorm);
