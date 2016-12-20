let dropdownMenuIsOpened = false;

$.fn.escapeableTextComplete = function(strategies, options, ...otherArgs) {
  options = {
    onKeydown(evt, commands) {
      if (evt.keyCode === 9 || evt.keyCode === 13) {
        evt.stopPropagation();
        return commands.KEY_ENTER;
      }
      return null;
    },
    ...options,
  };

  // Proxy to the vanilla jQuery component
  this.textcomplete(strategies, options, ...otherArgs);
  this.on({
    'textComplete:show'() {
      dropdownMenuIsOpened = true;
    },
    'textComplete:hide'() {
      Tracker.afterFlush(() => {
        setTimeout(() => {
          dropdownMenuIsOpened = false;
        }, 100);
      });
    },
  });
};

EscapeActions.register('textcomplete',
  () => {},
  () => dropdownMenuIsOpened, {
    noClickEscapeOn: '.textcomplete-dropdown',
  }
);
