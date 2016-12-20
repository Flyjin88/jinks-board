const currentlyOpenedForm = new ReactiveVar(null);

InlinedForm = BlazeComponent.extendComponent({
  template() {
    return 'inlinedForm';
  },

  onCreated() {
    this.isOpen = new ReactiveVar(false);
  },

  onDestroyed() {
    currentlyOpenedForm.set(null);
  },

  open(evt) {
    evt && evt.preventDefault();

    // Close currently opened form, if any
    EscapeActions.executeUpTo('inlinedForm');
    this.isOpen.set(true);
    currentlyOpenedForm.set(this);
  },

  close() {
    this.isOpen.set(false);
    currentlyOpenedForm.set(null);
  },

  getValue() {
    const input = this.find('textarea,input[type=text]');
    return this.isOpen.get() && input && input.value;
  },

  events() {
    return [{
      'click .js-close-inlined-form': this.close,
      'click .js-open-inlined-form': this.open,

      // Pressing Ctrl+Enter should submit the form
      'keydown form textarea'(evt) {
        if (evt.keyCode === 13 && (evt.metaKey || evt.ctrlKey)) {
          this.find('button[type=submit]').click();
        }
      },

      // Close the inlined form when after its submission
      submit() {
        if (this.currentData().autoclose !== false) {
          Tracker.afterFlush(() => {
            this.close();
          });
        }
      },
    }];
  },
}).register('inlinedForm');

// Press escape to close the currently opened inlinedForm
EscapeActions.register('inlinedForm',
  () => { currentlyOpenedForm.get().close(); },
  () => { return currentlyOpenedForm.get() !== null; }, {
    noClickEscapeOn: '.js-inlined-form',
  }
);
