Tracker.autorun(() => {
  const currentUser = Meteor.user();
  let language;
  if (currentUser) {
    language = currentUser.profile && currentUser.profile.language;
  } else {
    language = navigator.language || navigator.userLanguage;
  }

  if (language) {
    TAPi18n.setLanguage(language);

    // XXX
    const shortLanguage = language.split('-')[0];
    T9n.setLanguage(shortLanguage);
  }
});
