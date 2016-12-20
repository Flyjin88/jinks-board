// buffer each user's email text in a queue, then flush them in single email
Meteor.startup(() => {
  Notifications.subscribe('email', (user, title, description, params) => {
    const quoteParams = _.clone(params);
    ['card', 'list', 'oldList', 'board', 'comment'].forEach((key) => {
      if (quoteParams[key]) quoteParams[key] = `"${params[key]}"`;
    });

    const text = `${params.user} ${TAPi18n.__(description, quoteParams, user.getLanguage())}\n${params.url}`;
    user.addEmailBuffer(text);

    const userId = user._id;
    Meteor.setTimeout(() => {
      const user = Users.findOne(userId);
      const texts = user.getEmailBuffer();
      if (texts.length === 0) return;

      const text = texts.join('\n\n');
      user.clearEmailBuffer();

      try {
        Email.send({
          to: user.emails[0].address,
          from: Accounts.emailTemplates.from,
          subject: TAPi18n.__('act-activity-notify', {}, user.getLanguage()),
          text,
        });
      } catch (e) {
        return;
      }
    }, 30000);
  });
});
