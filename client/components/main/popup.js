Popup.template.events({
  'click .js-back-view'() {
    Popup.back();
  },
  'click .js-close-pop-over'() {
    Popup.close();
  },
  'click .js-confirm'() {
    this.__afterConfirmAction.call(this);
  },

  'scroll .content-wrapper'(evt) {
    evt.currentTarget.scrollLeft = 0;
  },
});

Popup.template.onRendered(() => {
  const container = this.find('.content-container');
  container._uihooks = {
    removeElement(node) {
      $(node).addClass('no-height');
      $(container).one(CSSEvents.transitionend, () => {
        node.parentNode.removeChild(node);
      });
    },
  };
});
