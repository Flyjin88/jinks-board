const passwordField = AccountsTemplates.removeField('password');
const emailField = AccountsTemplates.removeField('email');
AccountsTemplates.addFields([{
  _id: 'username',
  type: 'text',
  displayName: 'username',
  required: true,
  minLength: 2,
}, emailField, passwordField]);

AccountsTemplates.configure({
  defaultLayout: 'userFormsLayout',
  defaultContentRegion: 'content',
  confirmPassword: false,
  enablePasswordChange: true,
  sendVerificationEmail: true,
  showForgotPasswordLink: true,
  onLogoutHook() {
    const homePage = 'home';
    if (FlowRouter.getRouteName() === homePage) {
      FlowRouter.reload();
    } else {
      FlowRouter.go(homePage);
    }
  },
});

['signIn', 'signUp', 'resetPwd', 'forgotPwd', 'enrollAccount'].forEach(
  (routeName) => AccountsTemplates.configureRoute(routeName));

AccountsTemplates.configure({
  texts: {
    title: {
      changePwd: '',
    },
  },
});

AccountsTemplates.configureRoute('changePwd', {
  redirect() {
    Popup.back();
  },
});

if (Meteor.isServer) {
  if (process.env.MAIL_FROM) {
    Accounts.emailTemplates.from = process.env.MAIL_FROM;
  }

  ['resetPassword-subject', 'resetPassword-text', 'verifyEmail-subject', 'verifyEmail-text', 'enrollAccount-subject', 'enrollAccount-text'].forEach((str) => {
    const [templateName, field] = str.split('-');
    Accounts.emailTemplates[templateName][field] = (user, url) => {
      return TAPi18n.__(`email-${str}`, {
        url,
        user: user.getName(),
        siteName: Accounts.emailTemplates.siteName,
      }, user.getLanguage());
    };
  });
}
