const commentFormIsOpen = new ReactiveVar(false);

BlazeComponent.extendComponent({
  onDestroyed() {
    commentFormIsOpen.set(false);
  },

  commentFormIsOpen() {
    return commentFormIsOpen.get();
  },

  getInput() {
    return this.$('.js-new-comment-input');
  },

  events() {
    return [{
      'click .js-new-comment:not(.focus)'() {
        commentFormIsOpen.set(true);
      },
      'submit .js-new-comment-form'(evt) {
        const input = this.getInput();
        const text = input.val().trim();
        if (text) {
          CardComments.insert({
            text,
            boardId: this.currentData().boardId,
            cardId: this.currentData()._id,
          });
          resetCommentInput(input);
          Tracker.flush();
          autosize.update(input);
        }
        evt.preventDefault();
      },
      // Pressing Ctrl+Enter should submit the form
      'keydown form textarea'(evt) {
        if (evt.keyCode === 13 && (evt.metaKey || evt.ctrlKey)) {
          this.find('button[type=submit]').click();
        }
      },
    }];
  },
}).register('commentForm');

function resetCommentInput(input) {
  input.val('');
  input.blur();
  commentFormIsOpen.set(false);
}

Tracker.autorun(() => {
  Session.get('currentCard');
  Tracker.afterFlush(() => {
    autosize.update($('.js-new-comment-input'));
  });
});

EscapeActions.register('inlinedForm',
  () => {
    const draftKey = {
      fieldName: 'cardComment',
      docId: Session.get('currentCard'),
    };
    const commentInput = $('.js-new-comment-input');
    const draft = commentInput.val().trim();
    if (draft) {
      UnsavedEdits.set(draftKey, draft);
    } else {
      UnsavedEdits.reset(draftKey);
    }
    resetCommentInput(commentInput);
  },
  () => { return commentFormIsOpen.get(); }, {
    noClickEscapeOn: '.js-new-comment',
  }
);
