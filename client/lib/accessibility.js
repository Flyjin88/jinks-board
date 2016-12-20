function enforceHref(attributes) {
  if (!_.has(attributes, 'href')) {
    attributes.href = '#';
  }
  return attributes;
}

function copyTitleInAriaLabel(attributes) {
  if (!_.has(attributes, 'aria-label') && _.has(attributes, 'title')) {
    attributes['aria-label'] = attributes.title;
  }
  return attributes;
}

const {
  A: superA,
  I: superI,
} = HTML;

HTML.A = (attributes, ...others) => {
  return superA(copyTitleInAriaLabel(enforceHref(attributes)), ...others);
};

HTML.I = (attributes, ...others) => {
  return superI(copyTitleInAriaLabel(attributes), ...others);
};
