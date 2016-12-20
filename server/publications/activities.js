Meteor.publish('activities', (kind, id, limit) => {
  check(kind, Match.Where((x) => {
    return ['board', 'card'].indexOf(x) !== -1;
  }));
  check(id, String);
  check(limit, Number);

  return Activities.find({
    [`${kind}Id`]: id,
  }, {
    limit,
    sort: {createdAt: -1},
  });
});
