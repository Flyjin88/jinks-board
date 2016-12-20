window.Popup = new class {
  constructor() {
    // The template we use to render popups
    this.template = Template.popup;
    this._current = null;
    this._stack = [];
    this._dep = new Tracker.Dependency();
  }

  open(name) {
    const self = this;
    const popupName = `${name}Popup`;

    function clickFromPopup(evt) {
      return $(evt.target).closest('.js-pop-over').length !== 0;
    }

    return function(evt) {
      if (self.isOpen()) {
        const previousOpenerElement = self._getTopStack().openerElement;
        if (previousOpenerElement === evt.currentTarget) {
          self.close();
          return;
        } else {
          $(previousOpenerElement).removeClass('is-active');
        }
      }

      let openerElement;
      if (clickFromPopup(evt)) {
        openerElement = self._getTopStack().openerElement;
      } else {
        self._stack = [];
        openerElement = evt.currentTarget;
      }

      $(openerElement).addClass('is-active');
      evt.preventDefault();

      self._stack.push({
        popupName,
        openerElement,
        hasPopupParent: clickFromPopup(evt),
        title: self._getTitle(popupName),
        depth: self._stack.length,
        offset: self._getOffset(openerElement),
        dataContext: this.currentData && this.currentData() || this,
      });

      if (!self.isOpen()) {
        self.current = Blaze.renderWithData(self.template, () => {
          self._dep.depend();
          return { ...self._getTopStack(), stack: self._stack };
        }, document.body);

      } else {
        self._dep.changed();
      }
    };
  }

  afterConfirm(name, action) {
    const self = this;

    return function(evt, tpl) {
      const context = this.currentData && this.currentData() || this;
      context.__afterConfirmAction = action;
      self.open(name).call(context, evt, tpl);
    };
  }

  /// The public reactive state of the popup.
  isOpen() {
    this._dep.changed();
    return Boolean(this.current);
  }

  back(n = 1) {
    if (this._stack.length > n) {
      _.times(n, () => this._stack.pop());
      this._dep.changed();
    } else {
      this.close();
    }
  }

  /// Close the current opened popup.
  close() {
    if (this.isOpen()) {
      Blaze.remove(this.current);
      this.current = null;

      const openerElement = this._getTopStack().openerElement;
      $(openerElement).removeClass('is-active');

      this._stack = [];
    }
  }

  getOpenerComponent() {
    const { openerElement } = Template.parentData(4);
    return BlazeComponent.getComponentForElement(openerElement);
  }

  // An utility fonction that returns the top element of the internal stack
  _getTopStack() {
    return this._stack[this._stack.length - 1];
  }

  _getOffset(element) {
    const $element = $(element);
    return () => {
      Utils.windowResizeDep.depend();

      if(Utils.isMiniScreen()) return { left:0, top:0 };

      const offset = $element.offset();
      const popupWidth = 300 + 15;
      return {
        left: Math.min(offset.left, $(window).width() - popupWidth),
        top: offset.top + $element.outerHeight(),
      };
    };
  }

  _getTitle(popupName) {
    return () => {
      const translationKey = `${popupName}-title`;

      const title = TAPi18n.__(translationKey);
      // when popup showed as full of small screen, we need a default header to clearly see [X] button
      const defaultTitle = Utils.isMiniScreen() ? 'Wekan' : false;
      return title !== translationKey ? title : defaultTitle;
    };
  }
};

const escapeActions = ['back', 'close'];
escapeActions.forEach((actionName) => {
  EscapeActions.register(`popup-${actionName}`,
    () => Popup[actionName](),
    () => Popup.isOpen(),
    {
      noClickEscapeOn: '.js-pop-over',
      enabledOnClick: actionName === 'close',
    }
  );
});
