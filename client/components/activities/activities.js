const activitiesPerPage = 20;

BlazeComponent.extendComponent({
  onCreated() {
    this.page = new ReactiveVar(1);
    this.loadNextPageLocked = false;
    const sidebar = this.parentComponent();
    sidebar.callFirstWith(null, 'resetNextPeak');
    this.autorun(() => {
      const mode = this.data().mode;
      const capitalizedMode = Utils.capitalize(mode);
      const id = Session.get(`current${capitalizedMode}`);
      const limit = this.page.get() * activitiesPerPage;
      if (id === null)
        return;

      this.subscribe('activities', mode, id, limit, () => {
        this.loadNextPageLocked = false;
        const nextPeakBefore = sidebar.callFirstWith(null, 'getNextPeak');
        sidebar.calculateNextPeak();
        const nextPeakAfter = sidebar.callFirstWith(null, 'getNextPeak');
        if (nextPeakBefore === nextPeakAfter) {
          sidebar.callFirstWith(null, 'resetNextPeak');
        }
      });
    });
  },

  loadNextPage() {
    if (this.loadNextPageLocked === false) {
      this.page.set(this.page.get() + 1);
      this.loadNextPageLocked = true;
    }
  },

  boardLabel() {
    return TAPi18n.__('this-board');
  },

  cardLabel() {
    return TAPi18n.__('this-card');
  },

  cardLink() {
    const card = this.currentData().card();
    return card && Blaze.toHTML(HTML.A({
      href: card.absoluteUrl(),
      'class': 'action-card',
    }, card.title));
  },

  listLabel() {
    return this.currentData().list().title;
  },

  sourceLink() {
    const source = this.currentData().source;
    if(source) {
      if(source.url) {
        return Blaze.toHTML(HTML.A({
          href: source.url,
        }, source.system));
      } else {
        return source.system;
      }
    }
    return null;
  },

  memberLink() {
    return Blaze.toHTMLWithData(Template.memberName, {
      user: this.currentData().member(),
    });
  },

  attachmentLink() {
    const attachment = this.currentData().attachment();
    // trying to display url before file is stored generates js errors
    return attachment && attachment.url({ download: true }) && Blaze.toHTML(HTML.A({
      href: FlowRouter.path(attachment.url({ download: true })),
      target: '_blank',
    }, attachment.name()));
  },

  events() {
    return [{
      'click .js-delete-comment'() {
        const commentId = this.currentData().commentId;
        CardComments.remove(commentId);
      },
      'submit .js-edit-comment'(evt) {
        evt.preventDefault();
        const commentText = this.currentComponent().getValue().trim();
        const commentId = Template.parentData().commentId;
        if (commentText) {
          CardComments.update(commentId, {
            $set: {
              text: commentText,
            },
          });
        }
      },
    }];
  },
}).register('activities');
